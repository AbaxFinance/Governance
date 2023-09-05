use ink::prelude::vec::*;
use openbrush::traits::{
    AccountId,
    Balance,
    Timestamp,
};
use scale::{
    Decode,
    Encode,
};

use super::RulesId;

#[derive(Debug, Clone, Copy, PartialEq, Encode, Decode, Default)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout))]

pub struct ProposalRules {
    /// minimal part of proposer stake in total stake to propose.
    pub minimum_stake_part_e12: u64,
    /// amount of native token to be deposited during proposal.
    pub deposit: Balance,
    /// during initial period required amount to finalize proposal falls from 100% to 50% of total votes.
    pub initial_period: Timestamp,
    /// time after start of proposal during which the required amount to finalize proposal is flat at 50%.
    pub flat_period: Timestamp,
    /// time after flat_period during which the required amount to finalize proposal linearly falls to 0.
    pub final_period: Timestamp,
    /// maximal possible reward for voters who vote for the proposal. 10^12 is 100% increased stake,
    pub maximal_voter_reward_part_e12: u64,
    /// the part of proposer stake to be slashed if proposal finishes with `DefeatedWithSlash`. 10^12 is 100% slashed stake.
    pub proposer_slash_part_e12: u64,
    /// the part of voter stake to be slashed if voter didn't vote for the proposal and the proposal was finalized after linear period. 10^12 is 100%.
    pub voter_slash_part_e12: u64,
}

#[derive(Debug, Clone, PartialEq, Encode, Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout))]
pub struct Transaction {
    /// The `AccountId` of the contract that is called in this transaction.
    pub callee: AccountId,
    /// The selector bytes that identifies the function of the callee that should be called.
    pub selector: [u8; 4],
    /// The SCALE encoded parameters that are passed to the called function.
    pub input: Vec<u8>,
    /// The amount of chain balance that is transferred to the callee.
    pub transferred_value: Balance,
}

/// A Proposal is what can be proposed
#[derive(Debug, Clone, PartialEq, Encode, Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout))]
pub struct Proposal {
    /// The rules chosen for this proposal
    pub rules_id: RulesId,
    /// The rewards for active voters to be claimed once Proposal is finalized
    pub voter_reward_part_e12: u64,
    /// Proposed transaction for execution.
    pub transactions: Vec<Transaction>,
}

#[derive(Debug, Clone, Copy, PartialEq, Encode, Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout))]
pub enum ProposalStatus {
    /// VotingPeriod
    Active,
    /// Reejcted by DAO
    Defeated,
    /// Rejected by DAO. Proposer was slashed.
    DefeatedWithSlash,
    /// Accepted by DAO. Ready for execution.
    Succeeded,
    /// Executed
    Executed,
}

#[derive(Debug, Clone, Copy, PartialEq, Encode, Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout))]
pub struct ProposalState {
    /// proposal status
    pub status: ProposalStatus,
    /// the proposer
    pub proposer: AccountId,
    /// The rewards for active voters to be claimed once Proposal is finalized
    pub voter_reward_part_e12: u64,
    /// rules_id
    pub rules_id: RulesId,
    /// time of proposition
    pub start: Timestamp,
    /// Stake::total_stake at start
    pub votes_at_start: Balance,
    /// Stake::counter_stake at start
    pub counter_at_start: Balance,
    /// time of proposal finalization. Some if proposal finalized. None if porposal is not finalized yet.
    pub finalized: Option<Timestamp>,
    /// amount of votes to accept the proposal
    pub votes_for: Balance,
    /// amount of votes to reject proposal
    pub votes_against: Balance,
    /// amount of votes to reject proposal and slash the proposer
    pub votes_against_with_slash: Balance,
}

#[derive(Debug, Clone, Copy, PartialEq, Encode, Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout))]
/// Possibilities to choose during voting
pub enum Vote {
    /// Agree
    Agreed,
    /// Disagree
    Disagreed,
    /// Disagree and slash the proposal. Should be chosen if the proposition is made to hurt the DAO.
    DisagreedWithProposerSlashing,
}

#[derive(Debug, Clone, Copy, PartialEq, Encode, Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout))]
pub struct UserVote {
    /// chosen Vote by user
    pub vote: Vote,
    /// amount of votes
    pub amount: Balance,
}

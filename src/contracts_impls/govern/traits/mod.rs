pub mod errors;
pub mod events;
pub mod structs;

pub use errors::*;
pub use events::*;
pub use structs::*;

use openbrush::traits::{AccountId, Balance, Hash, String, Timestamp};

use ink::prelude::vec::Vec;

pub type ProposalId = Hash;
pub type RulesId = u64;

#[openbrush::trait_definition]
pub trait GovernView {
    /// Returns hash of the appened encoded `desription_hash` to the encoded `proposal`.
    #[ink(message)]
    fn hash_proposal(&self, proposal: Proposal, description: String) -> Hash;

    /// Returns current proposal rules.
    #[ink(message)]
    fn rules(&self, rules_id: RulesId) -> Option<ProposalRules>;

    /// Returns if rules are allowed to use for new proposals
    #[ink(message)]
    fn rules_allowed(&self, rules_id: RulesId) -> bool;

    /// Returns number of rules + 1
    #[ink(message)]
    fn next_rule_id(&self) -> RulesId;

    /// Returns ProposalStatus of proposal with proposal_id (proposal Hash).
    #[ink(message)]
    fn status(&self, proposal_id: ProposalId) -> Option<ProposalStatus>;

    /// Returns minimum to finalize proposal at current timestamp
    #[ink(message)]
    fn minimum_to_finalize(&self, proposal_id: ProposalId) -> Result<Balance, GovernError>;

    /// Returns ProposalStatus of proposal with proposal_id (proposal Hash).
    #[ink(message)]
    fn state(&self, proposal_id: ProposalId) -> Option<ProposalState>;

    /// Returns ProposalStatus of proposal with proposal_id (proposal Hash).
    #[ink(message)]
    fn proposal_ids(&self) -> Vec<ProposalId>;

    /// Returns Some(UserVote) `account` has voted for `proposal_id` and None if hasn't.
    #[ink(message)]
    fn vote_of_for(&self, account: AccountId, proposal_id: ProposalId) -> Option<UserVote>;
}

#[openbrush::trait_definition]
pub trait Govern {
    /// Propose `proposal` with `describtion`. Only users with sufficient part of `total_stake` can propose.
    /// Proposal is identified by `proposal_id` which is `hash_proposal`.
    ///
    /// On success emits `ProposalCreated` event.
    ///
    /// # Errors
    /// Returns `RuleNotAllowed` if `proposal.rule_id` is not allowed.
    /// Returns `ProposalAlreadyExists` if `propsal` with the same `proposal_description` exists,
    /// Returns `InnsuficientVotes` if `caller`'s stake is smaller than `rules.minimum_stake_part_e12` or `caller` has initialized unstake.
    /// Returns `PropositionDeposit` if transferred_value is smaller than `rules.deposit`
    /// Returns `RewardMultiplier` if `proposal.voter_reward_multiplier_e12` was to hight.
    #[ink(message, payable)]
    fn propose(&mut self, proposal: Proposal, description: String) -> Result<Hash, GovernError>;

    /// Finilize `proposal_id` if the finalization conditions are met.
    /// If finalized with `Succeeded` or with `Defeated` the AZERO deposit is returned to the proposer.
    /// If finalized with `DefeatedWithSlash` deposit is not returned and the `StakeInternal::_slash_stake_of` is called.   
    ///
    /// On success emits `ProposalFinalized` event.
    ///
    /// # Errors
    /// Returns `ProposalDoesntExist` if proposal doesn't exist.
    /// Returns `NotActive` if proposal is not active.
    /// Returns `FinalizeCondition` if finalize condition wasn't met.
    /// Returns `TransferError` if proposal was finalized with `Succeeded`, `Defeated` and transfering  deposit of native currency to the proposer failed.
    #[ink(message)]
    fn finalize(&mut self, proposal_id: ProposalId) -> Result<(), GovernError>;

    /// Executes the `proposal` with `describtion_hash` which corresponds to the `proposal_id` with `Succeeded` status.
    ///
    /// On success emits `ProposalExecuted` event.
    ///
    /// # Errors
    /// Returns `ProposalDoesntExist` if proposal doesn't exist.
    /// Returns `WrongStatus` if proposal status is not `Succeeded`.
    /// Returns `UnderlyingTransactionReverted` if any of Transactions from the `proposal` fails.
    #[ink(message)]
    fn execute(
        &mut self,
        proposal: Proposal,
        description_hash: [u8; 32],
    ) -> Result<(), GovernError>;

    /// Cast vote in the name of `caller` on `proposa_id` for `vote` with `reason`.
    /// `reason` is not stored. Only users with active stake can vote.
    ///
    /// On Success emits `VoteCasted` event.
    ///
    /// # Errors
    /// Returns `ZeroVotes` if `caller` has no votes.
    /// Returns `ProposalDoesntExist` if proposal doesn't exist.
    /// Returns `NotActive` if proposal status isn't `Active`.
    #[ink(message)]
    fn vote(
        &mut self,
        proposal_id: ProposalId,
        vote: Vote,
        reason: Vec<u8>,
    ) -> Result<(), GovernError>;
}

#[openbrush::trait_definition]
pub trait GovernRewardableSlashable {
    /// Returns true if `account` was already rewarded or slashed for taking/ not taking part in voting on `proposal_id`.  
    #[ink(message)]
    fn claimed_or_slashed(&self, account: AccountId, proposal_id: ProposalId) -> bool;

    /// Claims the reward for `account` or slashes `account` if voted for `proposal_id`.
    /// Modifies `account` stake and changes `claimed_or_slashed`.
    ///
    /// On Success emits `Claimed` event.
    ///
    /// # Errors
    ///
    /// Returns `ProposalDoesntExist` if proposal doesn't exist.
    /// Returns `WrongStatus` if proposal was not finalized.
    /// Returns `AlreadyClaimedOrSlashed` if reward was already claimed.
    /// Returns `DidntVote` if `account` didn't vote for the `proposal_id`
    /// Returns `InnsuficientVotes` if `account` is unstaking.
    #[ink(message)]
    fn claim_reward(&mut self, proposal_id: ProposalId) -> Result<(), GovernError>;

    /// Slashes the stake of `account` if didn't vote for `proposal_id` and `proposal_id` was finalized during "final_period".
    /// Modifies `account` stake and changes `claimed_or_slashed`.
    ///
    /// On Success emits `Slashed` event.
    ///
    /// # Errors
    ///
    /// Returns `ProposalDoesntExist` if proposal doesn't exist.
    /// Returns `WrongStatus` if proposal was not finalized.
    /// Returns `AlreadyClaimedOrSlashed` if reward was already claimed.
    /// Returns `Voted` if `account` voted for the `proposal_id`
    /// Returns `InnsuficientVotes` if `account` is unstaking.
    /// Returns `NothingToSlash` if `account` has not stake or has staken after the `proposal_id` was finalized or `proposal_id` has finalized in "flat period".
    #[ink(message)]
    fn slash_voter(
        &mut self,
        account: AccountId,
        proposal_id: ProposalId,
    ) -> Result<(), GovernError>;
}

#[openbrush::trait_definition]
pub trait GovernManage {
    /// Sets new `rules`
    ///
    /// On Success emits `ProposalRulesChanged` event.
    ///
    /// #Errors
    ///
    /// Returns wrapped `OwnableError` if the `caller` is not the `owner`.
    #[ink(message)]
    fn add_proposal_rules(&mut self, rules: ProposalRules) -> Result<(), GovernError>;

    /// Allow/Disallow to use `rules` identified by `rules_id`.
    ///
    /// On Success emits `RulesAllowed` event.
    ///
    /// #Errors
    ///
    /// Returns `NoSuchRule` if there in no rule identified by `rules_id`.
    /// Returns wrapped `OwnableError` if the `caller` is not the `owner`.
    #[ink(message)]
    fn allow_rules(&mut self, rule_id: RulesId, allow: bool) -> Result<(), GovernError>;
}

pub trait GovernInternal {
    /// Returns Hash of `proposal` with `description_hash`.
    fn _hash_proposal(&self, proposal: &Proposal, description_hash: &[u8; 32]) -> ProposalId;

    /// Returns rules identified by `rules_id`.
    fn _rule(&self, rules_id: &RulesId) -> Option<ProposalRules>;

    /// Returns if rules identified by `rules_id` may be used.
    fn _rule_allowed(&self, rules_id: &RulesId) -> bool;

    /// Returns first unassigned `rules_id`
    fn _next_rule_id(&self) -> RulesId;

    /// Checks if `proposal` and `caller` satisfy rules identified by `proposal.rules_id` to propose.
    ///
    /// # Errors
    ///
    /// Returns `RuleNotAllowed` if `proposal.rule_id` is not allowed.
    /// Returns `InnsuficientVotes` if `caller`'s stake is smaller than `rules.minimum_stake_part_e12` or `caller` has initialized unstake.
    /// Returns `PropositionDeposit` if transferred_value is smaller than `rules.deposit`
    /// Returns `RewardMultiplier` if `proposal.voter_reward_multiplier_e12` was to hight.
    fn _check_rules(&self, proposal: &Proposal) -> Result<(), GovernError>;

    /// Creates new `proposal` with `proposal_id` and `description`
    ///
    /// On success emits `ProposalCreated` event.
    ///
    /// # Errors
    /// Returns `ProposalAlreadyExists` if `propsal` with the same `proposal_description` exists,
    fn _register_proposal(
        &mut self,
        proposal_id: &ProposalId,
        proposal: &Proposal,
        description: &String,
    ) -> Result<(), GovernError>;

    /// Returs Some(ProposalStatus) of proposal identified by `proposal_id` if it exists. Otherwise None.
    fn _status_of(&self, proposal_id: &ProposalId) -> Option<ProposalStatus>;

    /// Returns ProposalState of proposal identified by `proposal_id` if it exists. Otherwise None.
    fn _state_of(&self, proposal_id: &ProposalId) -> Option<ProposalState>;

    /// Returns ProposalState of proposal identified by `proposal_id` if it exists. Otherwise None.
    fn _proposal_ids(&self) -> Vec<ProposalId>;

    /// Returns Some(UserVote) of `account` for `proposal_id` if `account has voted for the proposal. Otherwise None.
    fn _vote_of_for(&self, account: &AccountId, proposal_id: &ProposalId) -> Option<UserVote>;

    /// Returns the amount of `account` votes held at `timestamp`.
    fn _get_votes_at(&self, account: &AccountId, timestamp: &Timestamp) -> Balance;

    /// Updates (Casts or casts again) vote of `account` for `proposal_id` with `vote` and `amount`
    ///
    /// On Success emits `VoteCasted` event.
    ///
    /// # Errors
    /// Returns `ZeroVotes` if `caller` has no votes.
    /// Returns `ProposalDoesntExist` if there is no proposal identified by `proposal_id`/
    /// Returns `NotActive` if proposal identified by `proposal_id` isnt Active.
    fn _update_vote_of_for(
        &mut self,
        account: &AccountId,
        proposal_id: &ProposalId,
        vote: &Vote,
        amount: &Balance,
    ) -> Result<(), GovernError>;

    /// Returns the minimal amount of votes to finalize proposal with `state` that uses `rules` at time `now`.    
    fn _minimum_to_finalize(
        &self,
        state: &ProposalState,
        rules: &ProposalRules,
        now: Timestamp,
    ) -> Balance;

    /// Finalizes proposal identified by `proposal_id`
    ///
    /// On success emits `ProposalFinalized` event.
    ///
    /// # Errors
    /// Returns `ProposalDoesntExist` if there is no proposal identified by `proposal_id.
    /// Returns `NotActive` if proposal identified by `proposal_id` isnt Active.
    /// Returns `FinalizeCondition` if finalization condition wasn`t met.
    /// Returns `TransferError` if proposal was finalized with `Succeeded`, `Defeated` and transfering  deposit of native currency to the proposer failed.
    fn _finalize(&mut self, proposal_id: &ProposalId) -> Result<(), GovernError>;

    /// Executes the `proposal`
    ///
    /// On success emits `ProposalExecuted` event.
    ///
    /// # Errors
    /// Returns `ProposalDoesntExist` if there is no proposal identified by `proposal_id.
    /// Returns `WronfStatus` if proposal identified by `proposal_id` has different than Succeeded status.
    /// Returns `UnderlyingTransactionReverted` if any of Transactions from the `proposal` fails.
    fn _execute(
        &mut self,
        proposal_id: &ProposalId,
        proposal: &Proposal,
    ) -> Result<(), GovernError>;

    /// Adds new ProposalRules under `next_rules_id`
    ///
    /// On Success emits `ProposalRulesChanged` event.
    ///
    /// # Errors
    ///
    /// Returns `WrongParameters` if proposer_slash_part_e12 or voter_slash_part_e12 > E12.
    fn _add_new_rule(&mut self, rules: &ProposalRules) -> Result<(), GovernError>;

    /// Allow/Disallow to use `rules` identified by `rules_id`.
    ///
    /// On Success emits `RulesAllowed` event.
    ///
    /// #Errors
    ///
    /// Returns `NoSuchRule` if there in no rule identified by `rules_id`.
    fn _allow_rules(&mut self, rules_id: &RulesId, allow: &bool) -> Result<(), GovernError>;
}

pub trait GovernRewardableSlashableInternal {
    fn _claimed_or_slashed(&self, account: &AccountId, proposal_id: &ProposalId) -> bool;

    /// Claims the reward for `account` or slashes `account` if voted for `proposal_id`.
    /// Modifies `account` stake and changes `claimed_or_slashed`.
    ///
    /// On Success emits `Claimed` event.
    ///
    /// # Errors
    ///
    /// Returns `ProposalDoesntExist` if proposal doesn't exist.
    /// Returns `WrongStatus` if proposal was not finalized.
    /// Returns `AlreadyClaimedOrSlashed` if reward was already claimed.
    /// Returns `DidntVote` if `account` didn't vote for the `proposal_id`
    /// Returns `InnsuficientVotes` if `account` is unstaking.
    fn _reward_voter(
        &mut self,
        account: &AccountId,
        proposal_id: &ProposalId,
    ) -> Result<(), GovernError>;

    /// Slashes the stake of `account` if didn't vote for `proposal_id` and `proposal_id` was finalized during "final_period".
    /// Modifies `account` stake and changes `claimed_or_slashed`.
    ///
    /// On Success emits `Slashed` event.
    ///
    /// # Errors
    ///
    /// Returns `ProposalDoesntExist` if proposal doesn't exist.
    /// Returns `WrongStatus` if proposal was not finalized.
    /// Returns `AlreadyClaimedOrSlashed` if reward was already claimed.
    /// Returns `Voted` if `account` voted for the `proposal_id`
    /// Returns `InnsuficientVotes` if `account` is unstaking.
    /// Returns `NothingToSlash` if `account` has not stake or has staken after the `proposal_id` was finalized or `proposal_id` has finalized in "flat period".
    fn _slash_voter(
        &mut self,
        account: &AccountId,
        proposal_id: &ProposalId,
    ) -> Result<(), GovernError>;
}

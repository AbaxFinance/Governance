use openbrush::{
    storage::Mapping,
    traits::AccountId,
};

use crate::contracts_impls::govern::traits::{
    structs::*,
    ProposalId,
    RulesId,
};
use ink::prelude::vec::Vec;
pub const STORAGE_KEY: u32 = openbrush::storage_unique_key!(GovernStorage);
#[derive(Debug, Default)]
#[openbrush::upgradeable_storage(STORAGE_KEY)]
pub struct GovernStorage {
    // parameters
    pub rules: Mapping<RulesId, ProposalRules>,
    pub allowed_rules: Mapping<RulesId, ()>,
    pub next_rule_id: RulesId,
    // data
    pub proposal_ids: Vec<ProposalId>,
    pub active_proposals: u32,
    pub finalized_proposals: u32,
    pub state: Mapping<ProposalId, ProposalState>,
    pub votes: Mapping<(AccountId, ProposalId), UserVote>,
}

pub const STORAGE_KEY1: u32 = openbrush::storage_unique_key!(GovernRewardableSlashableStorage);
#[derive(Debug, Default)]
#[openbrush::upgradeable_storage(STORAGE_KEY1)]
pub struct GovernRewardableSlashableStorage {
    pub claimed_or_slashed: Mapping<(AccountId, ProposalId), ()>,
}

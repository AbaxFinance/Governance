use openbrush::traits::{
    AccountId,
    Hash,
    String,
};

use super::{
    Proposal,
    ProposalId,
    ProposalRules,
    ProposalStatus,
    RulesId,
    Vote,
};

pub trait EmitGovernEvents {
    fn _emit_proposal_created_event(&self, proposal_id: &ProposalId, proposal: &Proposal, description: &String);
    fn _emit_proposal_finalized_event(&self, proposal_id: &ProposalId, status: &ProposalStatus);
    fn _emit_proposal_executed_event(&self, proposal_id: &ProposalId);

    fn _emit_vote_casted_event(&self, account: &AccountId, proposal_id: &ProposalId, vote: &Vote);

    fn _emit_voter_rewarded_event(&self, account: &AccountId, proposal_id: &ProposalId);
    fn _emit_voter_slashed_event(&self, account: &AccountId, proposal_id: &Hash);

    fn _emit_proposal_rule_added_event(&self, rules_id: &RulesId, rules: &ProposalRules);

    fn _emit_rules_allowed_event(&self, rules_id: &RulesId, allowed: &bool);
}

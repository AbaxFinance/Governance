use openbrush::{
    storage::Mapping,
    traits::{
        AccountId,
        Balance,
    },
};

use crate::contracts_impls::{
    govern::traits::{
        structs::*,
        GovernError,
        ProposalId,
        RulesId,
    },
    stake::impls::E12,
};
pub const STORAGE_KEY: u32 = openbrush::storage_unique_key!(GovernStorage);
#[derive(Debug, Default)]
#[openbrush::storage_item]
pub struct GovernStorage {
    // parameters
    pub rules: Mapping<RulesId, ProposalRules>,
    pub allowed_rules: Mapping<RulesId, ()>,
    pub next_rule_id: RulesId,
    // data
    pub active_proposals: u32,
    pub finalized_proposals: u32,
    pub state: Mapping<ProposalId, ProposalState>,
    pub votes: Mapping<(AccountId, ProposalId), UserVote>,
}

impl GovernStorage {
    pub fn rule(&self, rules_id: &RulesId) -> Option<ProposalRules> {
        self.rules.get(&rules_id)
    }

    pub fn rule_allowed(&self, rules_id: &RulesId) -> bool {
        self.allowed_rules.get(&rules_id).is_some()
    }

    pub fn next_rule_id(&self) -> RulesId {
        self.next_rule_id
    }

    pub fn status_of(&self, proposal_id: &ProposalId) -> Option<ProposalStatus> {
        match self.state.get(proposal_id) {
            Some(state) => Some(state.status),
            None => None,
        }
    }

    pub fn state_of(&self, proposal_id: &ProposalId) -> Option<ProposalState> {
        self.state.get(proposal_id)
    }

    pub fn vote_of_for(&self, account: &AccountId, proposal_id: &ProposalId) -> Option<UserVote> {
        self.votes.get(&(*account, *proposal_id))
    }

    pub fn update_vote_of_for(
        &mut self,
        account: &AccountId,
        proposal_id: &ProposalId,
        vote: &Vote,
        amount: &Balance,
    ) -> Result<(), GovernError> {
        if *amount == 0 {
            return Err(GovernError::ZeroVotes)
        }
        let mut state = self.state_of(&proposal_id).ok_or(GovernError::ProposalDoesntExist)?;
        if state.status != ProposalStatus::Active {
            return Err(GovernError::NotActive)
        }

        let user_vote = self.vote_of_for(account, &proposal_id);
        match user_vote {
            None => {
                match vote {
                    Vote::Agreed => state.votes_for += *amount,
                    Vote::Disagreed => state.votes_against += *amount,
                    Vote::DisagreedWithProposerSlashing => state.votes_against_with_slash += *amount,
                }
            }
            Some(old_vote) => {
                match old_vote.vote {
                    Vote::Agreed => {
                        match vote {
                            Vote::Agreed => {
                                state.votes_for -= old_vote.amount;
                                state.votes_for += *amount;
                            }
                            Vote::Disagreed => {
                                state.votes_for -= old_vote.amount;
                                state.votes_against += *amount;
                            }
                            Vote::DisagreedWithProposerSlashing => {
                                state.votes_for -= old_vote.amount;
                                state.votes_against_with_slash += *amount;
                            }
                        }
                    }
                    Vote::Disagreed => {
                        match vote {
                            Vote::Agreed => {
                                state.votes_against -= old_vote.amount;
                                state.votes_for += *amount;
                            }
                            Vote::Disagreed => {
                                state.votes_against -= old_vote.amount;
                                state.votes_against += *amount;
                            }
                            Vote::DisagreedWithProposerSlashing => {
                                state.votes_against -= old_vote.amount;
                                state.votes_against_with_slash += *amount;
                            }
                        }
                    }
                    Vote::DisagreedWithProposerSlashing => {
                        match vote {
                            Vote::Agreed => {
                                state.votes_against_with_slash -= old_vote.amount;
                                state.votes_for += *amount;
                            }
                            Vote::Disagreed => {
                                state.votes_against_with_slash -= old_vote.amount;
                                state.votes_against += *amount;
                            }
                            Vote::DisagreedWithProposerSlashing => {
                                state.votes_against_with_slash -= old_vote.amount;
                                state.votes_against_with_slash += *amount;
                            }
                        }
                    }
                }
            }
        }

        let new_vote = UserVote {
            vote: *vote,
            amount: *amount,
        };

        self.votes.insert(&(*account, *proposal_id), &new_vote);

        self.state.insert(proposal_id, &state);
        Ok(())
    }

    pub fn add_new_rule(&mut self, rules: &ProposalRules) -> Result<u64, GovernError> {
        if rules.proposer_slash_part_e12 as u128 > E12 || rules.voter_slash_part_e12 as u128 > E12 {
            return Err(GovernError::WrongParameters)
        }
        let next_rule_id = self.next_rule_id;

        self.rules.insert(&(next_rule_id), rules);

        self.next_rule_id = next_rule_id + 1;
        Ok(next_rule_id)
    }

    pub fn allow_rules(&mut self, rules_id: &RulesId, allow: &bool) -> Result<(), GovernError> {
        if self.rule(&rules_id).is_none() {
            return Err(GovernError::NoSuchRule)
        }

        if self.rule_allowed(&rules_id) == *allow {
            return Ok(())
        }

        if *allow == true {
            self.allowed_rules.insert(&rules_id, &());
        } else {
            self.allowed_rules.remove(&rules_id);
        }
        Ok(())
    }
}

#[derive(Debug, Default)]
#[openbrush::storage_item]
pub struct GovernRewardableSlashableStorage {
    pub claimed_or_slashed: Mapping<(AccountId, ProposalId), ()>,
}

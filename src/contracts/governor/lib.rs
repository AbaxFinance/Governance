#![cfg_attr(not(feature = "std"), no_std, no_main)]
#![feature(min_specialization)]
#[openbrush::contract]
pub mod governor {

    use abax_governance::contracts_impls::{
        govern::{
            impls::storage::{
                GovernRewardableSlashableStorage,
                GovernStorage,
            },
            traits::{
                EmitGovernEvents,
                Proposal,
                ProposalRules,
                ProposalStatus,
                RulesId,
                *,
            },
        },
        stake::{
            impls::storage::data::{
                StakeCounterStorage,
                StakeStorage,
                StakeTimesStorage,
            },
            traits::*,
        },
        timestamp_mock::{
            impls::TimestampMockStorage,
            traits::*,
        },
    };

    // imports from ink!
    use ink::codegen::{
        EmitEvent,
        Env,
    };

    // imports from openbrush
    use openbrush::{
        contracts::ownable::*,
        traits::{
            Storage,
            String,
        },
    };

    #[ink(storage)]
    #[derive(Default, Storage)]
    pub struct Governor {
        #[storage_field]
        ownable: ownable::Data,
        #[storage_field]
        stake: StakeStorage,
        #[storage_field]
        stake_times: StakeTimesStorage,
        #[storage_field]
        stake_counter: StakeCounterStorage,
        #[storage_field]
        timestamp: TimestampMockStorage,
        #[storage_field]
        gov: GovernStorage,
        #[storage_field]
        gov_reward: GovernRewardableSlashableStorage,
    }

    // Section contains default implementation without any modifications
    impl Ownable for Governor {}
    impl Stake for Governor {}
    impl StakeView for Governor {}
    impl StakeCounter for Governor {}
    impl StakeTimes for Governor {}
    impl StakeManage for Governor {}
    impl GovernView for Governor {}
    impl Govern for Governor {}
    impl GovernManage for Governor {}
    impl GovernRewardableSlashable for Governor {}
    impl TimestampMock for Governor {}

    impl Governor {
        #[ink(constructor)]
        pub fn new(
            want: AccountId,
            unstake_period: Timestamp,
            maximal_number_of_unstakes: u64,
            rules: ProposalRules,
        ) -> Self {
            let mut _instance = Self::default();
            _instance.ownable._init_with_owner(_instance.env().account_id());

            _instance.stake.want = want;
            _instance.stake.change_unstake_period(&unstake_period);
            _instance
                .stake
                .change_maximal_number_of_unstakes(&maximal_number_of_unstakes);
            _instance.gov.add_new_rule(&rules).expect("add_new_rule");
            _instance.gov.allow_rules(&0, &true).expect("allow_rule");
            _instance
        }

        #[ink(message)]
        pub fn active_proposals(&self) -> u32 {
            self.gov.active_proposals
        }

        #[ink(message)]
        pub fn finalized_proposals(&self) -> u32 {
            self.gov.finalized_proposals
        }

        #[ink(message)]
        #[openbrush::modifiers(only_owner())]
        pub fn set_code_hash(&mut self, code_hash: [u8; 32]) -> Result<(), OwnableError> {
            ink::env::set_code_hash(&code_hash)
                .unwrap_or_else(|err| panic!("Failed to `set_code_hash` to {:?} due to {:?}", code_hash, err));
            ink::env::debug_println!("Switched code hash to {:?}.", code_hash);
            Ok(())
        }
    }

    #[ink(event)]
    pub struct OwnershipTransferred {
        #[ink(topic)]
        previous: Option<AccountId>,
        #[ink(topic)]
        new: Option<AccountId>,
    }

    impl ownable::Internal for Governor {
        fn _emit_ownership_transferred_event(&self, previous: Option<AccountId>, new: Option<AccountId>) {
            EmitEvent::<Governor>::emit_event(self.env(), OwnershipTransferred { previous, new })
        }
    }

    #[ink(event)]
    pub struct Staked {
        #[ink(topic)]
        caller: AccountId,
        amount: Balance,
    }

    #[ink(event)]
    pub struct InitializedUnstake {
        #[ink(topic)]
        caller: AccountId,
        amount: Balance,
    }

    #[ink(event)]
    pub struct Unstaked {
        #[ink(topic)]
        caller: AccountId,
    }

    #[ink(event)]
    pub struct Rewarded {
        #[ink(topic)]
        account: AccountId,
        amount: Balance,
    }

    #[ink(event)]
    pub struct Slashed {
        #[ink(topic)]
        account: AccountId,
        amount: Balance,
    }

    #[ink(event)]
    pub struct UnstakePeriodChanged {
        unstake_period: Timestamp,
    }

    #[ink(event)]
    pub struct MaximalNumberOfUnstakesChanged {
        maximal_number_of_unstakes: Timestamp,
    }

    impl EmitStakeEvents for Governor {
        fn _emit_staked_event(&self, caller: &AccountId, amount: &Balance) {
            EmitEvent::<Governor>::emit_event(
                self.env(),
                Staked {
                    caller: *caller,
                    amount: *amount,
                },
            )
        }

        fn _emit_initialized_unstake_event(&self, caller: &AccountId, amount: &Balance) {
            EmitEvent::<Governor>::emit_event(
                self.env(),
                InitializedUnstake {
                    caller: *caller,
                    amount: *amount,
                },
            )
        }

        fn _emit_unstake_event(&self, caller: &AccountId) {
            EmitEvent::<Governor>::emit_event(self.env(), Unstaked { caller: *caller })
        }
        fn _emit_rewarded_event(&self, account: &AccountId, amount: &Balance) {
            EmitEvent::<Governor>::emit_event(
                self.env(),
                Rewarded {
                    account: *account,
                    amount: *amount,
                },
            );
        }
        fn _emit_slashed_event(&self, account: &AccountId, amount: &Balance) {
            EmitEvent::<Governor>::emit_event(
                self.env(),
                Slashed {
                    account: *account,
                    amount: *amount,
                },
            );
        }
        fn _emit_unstake_period_changed_event(&self, unstake_period: &Timestamp) {
            EmitEvent::<Governor>::emit_event(
                self.env(),
                UnstakePeriodChanged {
                    unstake_period: *unstake_period,
                },
            );
        }
        fn _emit_maximal_number_of_unstakes_changed_event(&self, maximal_number_of_unstakes: &u64) {
            EmitEvent::<Governor>::emit_event(
                self.env(),
                MaximalNumberOfUnstakesChanged {
                    maximal_number_of_unstakes: *maximal_number_of_unstakes,
                },
            );
        }
    }

    #[ink(event)]
    pub struct ProposalCreated {
        #[ink(topic)]
        proposal_id: ProposalId,
        #[ink(topic)]
        proposal: Proposal,
        description: String,
    }

    #[ink(event)]
    pub struct ProposalFinalized {
        #[ink(topic)]
        proposal_id: ProposalId,
        #[ink(topic)]
        status: ProposalStatus,
    }

    #[ink(event)]
    pub struct ProposalExecuted {
        #[ink(topic)]
        proposal_id: ProposalId,
    }

    #[ink(event)]
    pub struct VoteCasted {
        #[ink(topic)]
        account: AccountId,
        #[ink(topic)]
        proposal_id: ProposalId,
        vote: Vote,
    }

    #[ink(event)]
    pub struct VoterRewarded {
        #[ink(topic)]
        account: AccountId,
        #[ink(topic)]
        proposal_id: ProposalId,
    }

    #[ink(event)]
    pub struct VoterSlashed {
        #[ink(topic)]
        account: AccountId,
        #[ink(topic)]
        proposal_id: ProposalId,
    }

    #[ink(event)]
    pub struct ProposalRulesAdded {
        #[ink(topic)]
        rules_id: RulesId,
        rules: ProposalRules,
    }

    #[ink(event)]
    pub struct RulesAllowed {
        #[ink(topic)]
        rules_id: RulesId,
        allowed: bool,
    }

    impl EmitGovernEvents for Governor {
        fn _emit_proposal_created_event(&self, proposal_id: &ProposalId, proposal: &Proposal, description: &String) {
            EmitEvent::<Governor>::emit_event(
                self.env(),
                ProposalCreated {
                    proposal_id: *proposal_id,
                    proposal: proposal.clone(),
                    description: description.clone(),
                },
            )
        }
        fn _emit_proposal_finalized_event(&self, proposal_id: &ProposalId, status: &ProposalStatus) {
            EmitEvent::<Governor>::emit_event(
                self.env(),
                ProposalFinalized {
                    proposal_id: *proposal_id,
                    status: *status,
                },
            )
        }
        fn _emit_proposal_executed_event(&self, proposal_id: &ProposalId) {
            EmitEvent::<Governor>::emit_event(
                self.env(),
                ProposalExecuted {
                    proposal_id: *proposal_id,
                },
            )
        }

        fn _emit_vote_casted_event(&self, account: &AccountId, proposal_id: &ProposalId, vote: &Vote) {
            EmitEvent::<Governor>::emit_event(
                self.env(),
                VoteCasted {
                    account: *account,
                    proposal_id: *proposal_id,
                    vote: *vote,
                },
            )
        }

        fn _emit_voter_rewarded_event(&self, account: &AccountId, proposal_id: &ProposalId) {
            EmitEvent::<Governor>::emit_event(
                self.env(),
                VoterRewarded {
                    account: *account,
                    proposal_id: *proposal_id,
                },
            )
        }

        fn _emit_voter_slashed_event(&self, account: &AccountId, proposal_id: &ProposalId) {
            EmitEvent::<Governor>::emit_event(
                self.env(),
                VoterSlashed {
                    account: *account,
                    proposal_id: *proposal_id,
                },
            )
        }

        fn _emit_proposal_rule_added_event(&self, rules_id: &RulesId, rules: &ProposalRules) {
            EmitEvent::<Governor>::emit_event(
                self.env(),
                ProposalRulesAdded {
                    rules_id: *rules_id,
                    rules: *rules,
                },
            )
        }

        fn _emit_rules_allowed_event(&self, rules_id: &RulesId, allowed: &bool) {
            EmitEvent::<Governor>::emit_event(
                self.env(),
                RulesAllowed {
                    rules_id: *rules_id,
                    allowed: *allowed,
                },
            )
        }
    }
}

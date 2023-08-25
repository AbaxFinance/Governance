#![cfg_attr(not(feature = "std"), no_std, no_main)]
#![feature(min_specialization)]
#[openbrush::contract]
pub mod staker {

    use abax_governance::contracts_impls::stake::impls::StakeCounterStorage;
    use abax_governance::contracts_impls::stake::impls::StakeStorage;
    use abax_governance::contracts_impls::stake::impls::StakeTimesStorage;
    use abax_governance::contracts_impls::stake::traits::*;

    use abax_governance::contracts_impls::timestamp_mock::impls::TimestampMockStorage;
    use abax_governance::contracts_impls::timestamp_mock::traits::*;

    // imports from ink!
    use ink::codegen::{EmitEvent, Env};
    // imports from openbrush
    use openbrush::contracts::ownable::*;
    use openbrush::traits::Storage;

    #[ink(storage)]
    #[derive(Default, Storage)]
    pub struct Staker {
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
    }

    // Section contains default implementation without any modifications
    impl Ownable for Staker {}
    impl Stake for Staker {}
    impl StakeView for Staker {}
    impl StakeManage for Staker {}
    impl StakeCounter for Staker {}
    impl StakeTimes for Staker {}
    impl StakeRewardable for Staker {}
    impl StakeSlashable for Staker {}

    impl TimestampMock for Staker {}

    impl Staker {
        #[ink(constructor)]
        pub fn new(
            want: AccountId,
            unstake_period: Timestamp,
            maximal_number_of_initialized_unstakes: u64,
        ) -> Self {
            let mut _instance = Self::default();
            _instance
                .ownable
                ._init_with_owner(_instance.env().account_id());

            _instance.stake.want = want;
            _instance.stake.unstake_period = unstake_period;
            _instance.stake.maximal_number_of_unstakes = maximal_number_of_initialized_unstakes;
            _instance
        }
    }

    #[ink(event)]
    pub struct OwnershipTransferred {
        #[ink(topic)]
        previous: Option<AccountId>,
        #[ink(topic)]
        new: Option<AccountId>,
    }

    impl ownable::Internal for Staker {
        fn _emit_ownership_transferred_event(
            &self,
            previous: Option<AccountId>,
            new: Option<AccountId>,
        ) {
            EmitEvent::<Staker>::emit_event(self.env(), OwnershipTransferred { previous, new })
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

    impl EmitStakeEvents for Staker {
        fn _emit_staked_event(&self, caller: &AccountId, amount: &Balance) {
            EmitEvent::<Staker>::emit_event(
                self.env(),
                Staked {
                    caller: *caller,
                    amount: *amount,
                },
            )
        }

        fn _emit_initialized_unstake_event(&self, caller: &AccountId, amount: &Balance) {
            EmitEvent::<Staker>::emit_event(
                self.env(),
                InitializedUnstake {
                    caller: *caller,
                    amount: *amount,
                },
            )
        }

        fn _emit_unstake_event(&self, caller: &AccountId) {
            EmitEvent::<Staker>::emit_event(self.env(), Unstaked { caller: *caller })
        }
        fn _emit_rewarded_event(&self, account: &AccountId, amount: &Balance) {
            EmitEvent::<Staker>::emit_event(
                self.env(),
                Rewarded {
                    account: *account,
                    amount: *amount,
                },
            );
        }
        fn _emit_slashed_event(&self, account: &AccountId, amount: &Balance) {
            EmitEvent::<Staker>::emit_event(
                self.env(),
                Slashed {
                    account: *account,
                    amount: *amount,
                },
            );
        }
        fn _emit_unstake_period_changed_event(&self, unstake_period: &Timestamp) {
            EmitEvent::<Staker>::emit_event(
                self.env(),
                UnstakePeriodChanged {
                    unstake_period: *unstake_period,
                },
            );
        }

        fn _emit_maximal_number_of_unstakes_changed_event(&self, maximal_number_of_unstakes: &u64) {
            EmitEvent::<Staker>::emit_event(
                self.env(),
                MaximalNumberOfUnstakesChanged {
                    maximal_number_of_unstakes: *maximal_number_of_unstakes,
                },
            );
        }
    }
}

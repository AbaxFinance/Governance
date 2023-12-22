#![cfg_attr(not(feature = "std"), no_std, no_main)]
#![feature(min_specialization)]
#[openbrush::implementation(Ownable)]
#[ink::contract]
pub mod staker {

    use abax_governance::contracts_impls::{
        stake::{
            impls::{
                storage::data::{
                    StakeCounterStorage,
                    StakeStorage,
                    StakeTimesStorage,
                },
                StakeCounterImpl,
                StakeImpl,
                StakeManageImpl,
                StakeRewardableImpl,
                StakeSlashableImpl,
                StakeTimesImpl,
                StakeViewImpl,
            },
            traits::*,
        },
        timestamp_mock::impls::TimestampMockImpl,
    };

    use abax_governance::contracts_impls::timestamp_mock::{
        impls::TimestampMockStorage,
        traits::*,
    };

    // imports from ink!
    use ink::codegen::{
        EmitEvent,
        Env,
    };
    // imports from openbrush
    use openbrush::{
        contracts::ownable::*,
        traits::Storage,
    };

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
    impl StakeImpl for Staker {}
    impl Stake for Staker {
        #[ink(message)]
        fn stake(&mut self, amount: Balance) -> Result<(), StakeError> {
            StakeImpl::stake(self, amount)
        }

        #[ink(message)]
        fn initialize_unstake(&mut self, amount: Balance) -> Result<(), StakeError> {
            StakeImpl::initialize_unstake(self, amount)
        }

        #[ink(message)]
        fn unstake(&mut self) -> Result<Balance, StakeError> {
            StakeImpl::unstake(self)
        }
    }
    impl StakeViewImpl for Staker {}
    impl StakeView for Staker {
        #[ink(message)]
        fn want(&self) -> AccountId {
            StakeViewImpl::want(self)
        }

        #[ink(message)]
        fn unstake_period(&self) -> Timestamp {
            StakeViewImpl::unstake_period(self)
        }

        #[ink(message)]
        fn maximal_number_of_unstakes(&self) -> u64 {
            StakeViewImpl::maximal_number_of_unstakes(self)
        }

        #[ink(message)]
        fn total_stake(&self) -> Balance {
            StakeViewImpl::total_stake(self)
        }

        #[ink(message)]
        fn total_unstake(&self) -> Balance {
            StakeViewImpl::total_unstake(self)
        }
        #[ink(message)]
        fn stake_of(&self, account: AccountId) -> Balance {
            StakeViewImpl::stake_of(self, account)
        }

        #[ink(message)]
        fn stake_and_unstakes_initialized_after(&self, account: AccountId, timestamp: Timestamp) -> Balance {
            StakeViewImpl::stake_and_unstakes_initialized_after(self, account, timestamp)
        }
        #[ink(message)]
        fn initialized_unstakes_of(&self, account: AccountId) -> Vec<Unstake> {
            StakeViewImpl::initialized_unstakes_of(self, account)
        }
    }
    impl StakeManageImpl for Staker {}
    impl StakeManage for Staker {
        #[ink(message)]
        fn change_unstake_period(&mut self, unstake_period: Timestamp) -> Result<(), StakeError> {
            StakeManageImpl::change_unstake_period(self, unstake_period)
        }
        #[ink(message)]
        fn change_maximal_number_of_unstakes(&mut self, maximal_number_of_unstakes: u64) -> Result<(), StakeError> {
            StakeManageImpl::change_maximal_number_of_unstakes(self, maximal_number_of_unstakes)
        }
    }

    impl StakeTimesImpl for Staker {}
    impl StakeTimes for Staker {
        /// Returns the Timestamp of first stake (or first after last unstake).
        #[ink(message)]
        fn stake_timestamp_of(&self, account: AccountId) -> Option<Timestamp> {
            StakeTimesImpl::stake_timestamp_of(self, account)
        }

        /// Returns the Timestamp of last stake (or last after last unstake).
        #[ink(message)]
        fn last_stake_timestamp_of(&self, account: AccountId) -> Option<Timestamp> {
            StakeTimesImpl::last_stake_timestamp_of(self, account)
        }
    }

    impl StakeCounterImpl for Staker {}
    impl StakeCounter for Staker {
        #[ink(message)]
        fn counter_stake(&self) -> Balance {
            StakeCounterImpl::counter_stake(self)
        }
    }

    impl StakeRewardableImpl for Staker {}
    impl StakeRewardable for Staker {
        #[ink(message)]
        fn reward(&mut self, account: AccountId, amount: Balance) -> Result<(), StakeError> {
            StakeRewardableImpl::reward(self, account, amount)
        }
    }

    impl StakeSlashableImpl for Staker {}
    impl StakeSlashable for Staker {
        #[ink(message)]
        fn slash(&mut self, account: AccountId, amount: Balance) -> Result<Balance, StakeError> {
            StakeSlashableImpl::slash(self, account, amount)
        }
    }

    impl TimestampMockImpl for Staker {}
    impl TimestampMock for Staker {
        #[ink(message)]
        fn set_timestamp_provider(&mut self, account: AccountId) {
            TimestampMockImpl::set_timestamp_provider(self, account)
        }

        #[ink(message)]
        fn timestamp_provider(&self) -> AccountId {
            TimestampMockImpl::timestamp_provider(self)
        }

        #[ink(message)]
        fn timestamp(&self) -> Timestamp {
            TimestampMockImpl::timestamp(self)
        }
    }

    impl Staker {
        #[ink(constructor)]
        pub fn new(want: AccountId, unstake_period: Timestamp, maximal_number_of_initialized_unstakes: u64) -> Self {
            let mut _instance = Self::default();
            // _instance.ownable._init_with_owner(_instance.env().account_id());

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
        fn _emit_ownership_transferred_event(&self, previous: Option<AccountId>, new: Option<AccountId>) {
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

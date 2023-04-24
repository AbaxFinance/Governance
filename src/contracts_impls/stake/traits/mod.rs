pub mod errors;
pub mod events;
pub mod structs;

pub use errors::*;
pub use events::*;
pub use openbrush::traits::{AccountId, Balance, Timestamp};
pub use structs::*;

pub type UnstakeId = u32;

pub use ink::prelude::{vec, vec::*};

#[openbrush::trait_definition]
pub trait StakeView {
    /// Retruns the AccountId of an asset (by default PSP22) that can be staked
    #[ink(message)]
    fn want(&self) -> AccountId;

    /// Returns the time that must pass between initialize_unstake and unstake
    #[ink(message)]
    fn unstake_period(&self) -> Timestamp;

    /// Returns the maximal number of initialized unstakes an account can have at one time
    #[ink(message)]
    fn maximal_number_of_unstakes(&self) -> u64;

    /// Returns total amount of tokens that are initialized for unstake and haven't been yet unstaken.
    #[ink(message)]
    fn total_stake(&self) -> Balance;

    /// Returns the amount of staked tokens by specified `account`.
    #[ink(message)]
    fn stake_of(&self, account: AccountId) -> Balance;

    /// Returns the total amount of tokens that have been initialized for unstake but haven't been yet unstaken.
    #[ink(message)]
    fn total_unstake(&self) -> Balance;

    /// Returns the stake of an `account` plus aomunt of tokens initialized for unstake after `timestamp`.
    #[ink(message)]
    fn stake_and_unstakes_initialized_after(
        &self,
        account: AccountId,
        timestamp: Timestamp,
    ) -> Balance;

    /// Returns the list of registered unstakes in orded from the earliest to the oldest.
    #[ink(message)]
    fn initialized_unstakes_of(&self, account: AccountId) -> Vec<Unstake>;
}
#[openbrush::trait_definition]
pub trait Stake {
    /// Stakes `amount` of `want` asset (can be PSP22) by transfering it from `caller` to self.
    ///
    /// On success emits `Staked` event.
    ///
    /// # Errors
    /// Retuns wrapeed error from `want` if transfer fails (can be wrapped `PSP22Error`)
    #[ink(message)]
    fn stake(&mut self, amount: Balance) -> Result<(), StakeError>;

    /// Initializes unstake for `caller`.
    /// Stores `block_timesstamp` and `amount` to allow for later `unstake`.
    ///
    /// On success emits `InitializedUnstake` event.
    ///
    /// # Errors
    /// Returns `NothingToUnstake` if `stakes` of key `caller` is 0.
    /// Returns `ToManyUnstakes` if the `account` has already `maximal_number_of_unstakes` initialized.
    #[ink(message)]
    fn initialize_unstake(&mut self, amount: Balance) -> Result<(), StakeError>;

    /// Based in `initialized_unstaked_of` `caller` transfers apropariate `amount` of `want` asset to `caller`.
    ///
    /// On success emits `Unstaked` event.
    ///
    /// # Errors
    /// Returns `NoInitializedUnstakes` if `caller` has no initialized unstakes.
    /// Returns `ToEarly` if no of `caller` initialized unstakes is ready for unstaking.
    /// Retuns wrapeed error from `want` if transfer fails (can be wrapped `PSP22Error`)
    #[ink(message)]
    fn unstake(&mut self) -> Result<Balance, StakeError>;
}

#[openbrush::trait_definition]
pub trait StakeTimes {
    /// Returns the Timestamp of first stake (or first after last unstake).
    #[ink(message)]
    fn stake_timestamp_of(&self, account: AccountId) -> Option<Timestamp>;

    /// Returns the Timestamp of last stake (or last after last unstake).
    #[ink(message)]
    fn last_stake_timestamp_of(&self, account: AccountId) -> Option<Timestamp>;
}

#[openbrush::trait_definition]
pub trait StakeCounter {
    /// Returns sum of all stakes ever done. May overflow.
    #[ink(message)]
    fn counter_stake(&self) -> Balance;
}

#[openbrush::trait_definition]
pub trait StakeManage {
    /// Changes the `unstaking_period`
    ///
    /// On success emits `UnstakePeriodChanged` event.
    ///
    /// # Errors
    ///
    /// Returns `OwnableError` if onwer required and the `caller` is not the owner.
    #[ink(message)]
    fn change_unstake_period(&mut self, unstake_period: Timestamp) -> Result<(), StakeError>;

    /// Changes the `maximal_number_of_unstakes`
    ///
    /// On success emits `MaximalNumberOfUnstakesChanged` event.
    ///
    /// # Errors
    ///
    /// Returns `OwnableError` if onwer required and the `caller` is not the owner.
    #[ink(message)]
    fn change_maximal_number_of_unstakes(
        &mut self,
        maximal_number_of_unstakes: u64,
    ) -> Result<(), StakeError>;
}

#[openbrush::trait_definition]
pub trait StakeRewardable {
    /// Rewards `account` by increasing it's stake by `amount`.
    ///
    /// On Success emits `Rewarded` event.
    ///
    /// # Errors
    ///
    /// Returns `Unstaking` error if the `unstakes_init_times` of key `caller` is Some.
    #[ink(message)]
    fn reward(&mut self, account: AccountId, amount: Balance) -> Result<(), StakeError>;
}

#[openbrush::trait_definition]
pub trait StakeSlashable {
    /// Slashes the stake of `account` by `amount`.
    /// If not enough stake it will slash initialized unstakes
    ///
    /// On Success emits `Slashed` event.
    ///
    /// # Errors
    /// -
    ///
    /// Returns amount that was slashed. For example id `amount` was 10 but only 6 could be slashed returns 6.
    #[ink(message)]
    fn slash(&mut self, account: AccountId, amount: Balance) -> Result<Balance, StakeError>;
}

pub trait StakeTransfer {
    /// Transfers `want` tokens from `account` to self.
    fn _transfer_in(&self, account: &AccountId, amount: &Balance) -> Result<(), StakeError>;

    /// Transfers `want` tokens from self to `account`.
    fn _transfer_out(&self, account: &AccountId, amount: &Balance) -> Result<(), StakeError>;

    /// Action made on rewarding, for example minting or noting reward in storage
    fn _on_reward(&self, amount: &Balance) -> Result<(), StakeError>;

    /// Action made on slashing, for example burning or noting reward in storage
    fn _on_slash(&self, amount: &Balance) -> Result<(), StakeError>;
}

pub trait StakeInternal {
    /// Returns the AccountId of PSP22 token that can be staked.
    fn _want(&self) -> AccountId;

    /// Returns the time that must pass between initialize_unstake and unstake.
    fn _unstake_period(&self) -> Timestamp;

    /// Returns the maximal number of active unstakes account can have.
    fn _maximal_number_of_unstakes(&self) -> u64;

    /// Returns the amount of tokens that are staked, including tokens that are initialized for unstaking.
    fn _total_stake(&self) -> Balance;

    /// Returns the amount of tokens that are initialized for unstaking.
    fn _total_unstake(&self) -> Balance;

    /// Returns the amount of staked tokens by specified `account`.
    fn _stake_of(&self, account: &AccountId) -> Option<Balance>;

    /// Returns the amount of staked tokens by specified `account` plus all unstakes done after `timestamp`.
    fn _stake_and_unstakes_initialized_after(
        &self,
        account: &AccountId,
        timestamp: &Timestamp,
    ) -> Balance;

    /// Returns the list of registered unstakes in orded from the earliest to the oldest.
    fn _initialized_unstakes_of(&self, account: &AccountId) -> Vec<Unstake>;

    /// Increase stake of `account` by `amount`.
    ///
    /// # Errors
    /// Returns `MathError::Add` if overflow happens.
    fn _increase_stake_of(
        &mut self,
        account: &AccountId,
        amount: &Balance,
    ) -> Result<(), StakeError>;

    /// Decrease stake of `account` by `amount`.
    ///
    /// # Errors
    /// Returns `InsufficientStake` error if the `stakes` of key `account` is lesser than `amount`.
    fn _decrease_stake_of(
        &mut self,
        account: &AccountId,
        amount: &Balance,
    ) -> Result<(), StakeError>;

    /// Decrease unstakes of `account` by `amount`.
    ///
    /// # Errors
    /// Returns `InsufficientStake` error if the `stakes` of key `account` is lesser than `amount`.
    fn _decrease_unstakes_of(
        &mut self,
        account: &AccountId,
        amount: &Balance,
    ) -> Result<Balance, StakeError>;

    /// Registers new unstake of `amount` for `account`
    ///
    /// # Errors
    /// Returns `ToManyUnstakes` if `account` has reached maximum number of unstakes
    fn _register_unstake(
        &mut self,
        account: &AccountId,
        amount: &Balance,
    ) -> Result<(), StakeError>;

    /// Removes all ready to unstake (unstakes for which unstaking period has passed) from storage.
    ///
    /// # Returns
    /// `Balance` - summed amound of removed unstakes
    ///
    /// # Errors
    /// None - ?
    fn _deregister_ready_unstakes(&mut self, account: &AccountId) -> Result<Balance, StakeError>;

    /// Rewards `account` by increasing its stake by `amount`. Calls `on_reward` method.
    ///
    /// # Errors
    /// Returns `AmountIsZero` if `amount` is 0.
    fn _reward(&mut self, account: &AccountId, amount: &Balance) -> Result<(), StakeError>;

    /// Slashes `account` by decreasing `account` stake and `unstakes` by up to `amount`
    ///
    /// # Errors
    /// Returns `AmountIsZero` if `amount is 0.
    fn _slash(&mut self, account: &AccountId, amount: &Balance) -> Result<Balance, StakeError>;

    /// Changes `unstake_period`
    ///
    /// # Error
    /// Returns `Ownable` or `AccessControl` Errors
    fn _change_unstake_period(&mut self, unstake_period: &Timestamp) -> Result<(), StakeError>;

    /// Changes `maximal_number_of_usntakes`
    ///
    /// # Error
    /// Returns `Ownable` or `AccessControl` Errors
    fn _change_maximal_number_of_unstakes(
        &mut self,
        maximal_number_of_unstakes: &u64,
    ) -> Result<(), StakeError>;
}

pub trait StakeTimesInternal {
    /// Returns the Timestamp of first stake. If `account` stake is 0 then returns None.
    fn _stake_timestamp_of(&self, account: &AccountId) -> Option<Timestamp>;

    /// Returns the Timestamp of last stake. If `account` stake is 0 then returns None.
    fn _last_stake_timestamp_of(&self, account: &AccountId) -> Option<Timestamp>;

    /// Set `stake_timestamp` and 'last_stake_timestamp' of key `account` to `block_timestamp`.
    fn _update_stake_timestamps_of(&mut self, account: &AccountId);

    /// Removes `stake_timestamp` and 'last_stake_timestamp' of key `account`
    fn _remove_stake_timestamps_of(&mut self, account: &AccountId);
}

pub trait StakeCounterInternal {
    /// Returns sum of all stakes ever done.
    fn _counter_stake(&self) -> Balance;

    /// Increase the counter, may overflow.
    fn _increase_counter(&mut self, amount: &Balance);
}

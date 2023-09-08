pub mod storage;

pub use crate::contracts_impls::stake::impls::storage::StakeTimesStorage;
use crate::contracts_impls::{
    stake::traits::{
        StakeInternal,
        *,
    },
    timestamp_mock::impls::{
        TimestampMockInternal,
        TimestampMockStorage,
    },
};
use ink::prelude::{
    vec::Vec,
    *,
};

use openbrush::{
    contracts::{
        ownable::*,
        psp22::extensions::{
            burnable::*,
            mintable::*,
        },
    },
    traits::Storage,
};

pub use self::storage::{
    StakeCounterStorage,
    StakeStorage,
};

pub const E12: u128 = 1_000_000_000_000;

impl<T: Storage<StakeStorage> + StakeInternal + StakeTransfer> StakeView for T {
    fn want(&self) -> AccountId {
        self._want()
    }

    fn unstake_period(&self) -> Timestamp {
        self._unstake_period()
    }

    fn maximal_number_of_unstakes(&self) -> u64 {
        self._maximal_number_of_unstakes()
    }

    fn total_stake(&self) -> Balance {
        self._total_stake()
    }

    fn total_unstake(&self) -> Balance {
        self._total_unstake()
    }
    fn stake_of(&self, account: AccountId) -> Balance {
        self._stake_of(&account).unwrap_or_default()
    }

    fn stake_and_unstakes_initialized_after(&self, account: AccountId, timestamp: Timestamp) -> Balance {
        self._stake_and_unstakes_initialized_after(&account, &timestamp)
    }
    fn initialized_unstakes_of(&self, account: AccountId) -> Vec<Unstake> {
        self._initialized_unstakes_of(&account)
    }
}

impl<
        T: Storage<StakeStorage>
            + StakeInternal
            + EmitStakeEvents
            + Storage<StakeTimesStorage>
            + StakeTimesInternal
            + Storage<StakeCounterStorage>
            + StakeCounterInternal
            + Storage<TimestampMockStorage>
            + TimestampMockInternal,
    > Stake for T
{
    /// # Storage modifications
    /// [StakeStorage]
    /// `stakes` of key `caller` increased by `amount`.
    /// `total_stake` increased by `amount`.
    /// [StakeTimesStorage]
    /// `stakes_timestamps` of key `caller` If None then set to `block_timestamp`.
    /// `last_stakes_timestamps` of key `caller` set to `block_timestamp`.
    /// [StakeCounterStorage]
    /// `counter` increased by amount.
    fn stake(&mut self, amount: Balance) -> Result<(), StakeError> {
        let caller = Self::env().caller();
        self._transfer_in(&caller, &amount)?;

        self._update_stake_timestamps_of(&caller);
        self._increase_stake_of(&caller, &amount)?;
        self._increase_counter(&amount);

        self._emit_staked_event(&caller, &amount);
        Ok(())
    }

    /// # Storage modifications
    /// [StakeStorage]
    /// `stakes` of key `caller` decreased by `amount` or removed if 0.
    /// `total_stake` decreased by `amount`.
    /// `total_unstake` increased by `amount`.
    /// `unstakes` of key `(caller)` pushed at back of Vec Unstakes { `block_timestamp`, `amount`}.
    /// [StakeTimesStorage]
    /// `stakes_timestamps` of key `caller` removed if `stakes` of key `caller` was removed.
    /// `last_stakes_timestamps` of key `caller` removed if `stakes` of key `caller` was removed.
    fn initialize_unstake(&mut self, amount: Balance) -> Result<(), StakeError> {
        let caller = Self::env().caller();
        let stake = self._stake_of(&caller).ok_or(StakeError::NothingToUnstake)?;

        self._decrease_stake_of(&caller, &amount)?;

        if stake == amount {
            self._remove_stake_timestamps_of(&caller);
        }

        self._register_unstake(&caller, &amount)?;

        self._emit_initialized_unstake_event(&caller, &amount);
        Ok(())
    }

    /// # Storage modifications
    /// [StakeStorage]
    /// `total_unstake` decreased by `amount`.
    /// `unstakes` of keys `(caller, unstakes_id.0.."some_id")` removed where "some_id" is first not ready for unstake or non existing.
    /// "unstakes_id" of key `caller` increased at 0th position to "some_id".
    fn unstake(&mut self) -> Result<Balance, StakeError> {
        let caller = Self::env().caller();

        let amount = self._deregister_ready_unstakes(&caller)?;

        self._transfer_out(&caller, &amount)?;

        self._emit_unstake_event(&caller);

        Ok(amount)
    }
}

impl<T: Storage<StakeCounterStorage> + StakeCounterInternal> StakeCounter for T {
    fn counter_stake(&self) -> Balance {
        self._counter_stake()
    }
}

impl<T: Storage<StakeTimesStorage> + StakeTimesInternal> StakeTimes for T {
    fn stake_timestamp_of(&self, account: AccountId) -> Option<Timestamp> {
        self._stake_timestamp_of(&account)
    }

    fn last_stake_timestamp_of(&self, account: AccountId) -> Option<Timestamp> {
        self._last_stake_timestamp_of(&account)
    }
}

impl<T: Storage<StakeStorage> + Storage<ownable::Data> + StakeInternal + EmitStakeEvents> StakeManage for T {
    /// # Storage modifications
    /// [StakeStorage]
    /// `unstake_period` set to `unstake_period`

    // #[modifiers(only_owner())]
    fn change_unstake_period(&mut self, unstake_period: Timestamp) -> Result<(), StakeError> {
        self._change_unstake_period(&unstake_period)
    }

    /// # Storage modifications
    /// [StakeStorage]
    /// `maximal_number_of_unstakes` set to `maximal_number_of_unstakes`

    // #[modifiers(only_owner())]
    fn change_maximal_number_of_unstakes(&mut self, maximal_number_of_unstakes: u64) -> Result<(), StakeError> {
        self._change_maximal_number_of_unstakes(&maximal_number_of_unstakes)
    }
}

impl<
        T: Storage<StakeStorage>
            + StakeInternal
            + Storage<StakeCounterStorage>
            + StakeCounterInternal
            + Storage<TimestampMockStorage>
            + TimestampMockInternal,
    > StakeRewardable for T
{
    /// # Storage modifications
    /// [StakeStorage]
    /// `stakes` of key `caller` increased by `amount`
    /// `total_stake` increased by `amount`
    /// [StakeCounterStorage]
    /// `counter` - increased by amount
    fn reward(&mut self, account: AccountId, amount: Balance) -> Result<(), StakeError> {
        self._reward(&account, &amount)?;
        Ok(())
    }
}

impl<
        T: Storage<StakeStorage>
            + StakeInternal
            + Storage<StakeTimesStorage>
            + StakeTimesInternal
            + Storage<TimestampMockStorage>
            + TimestampMockInternal,
    > StakeSlashable for T
{
    /// # Storage modifications
    /// [StakeStorage]
    /// `stakes` of key `caller` decreased by max(`amount`,`stakes` of key `caller`). Ig becomes 0 then remove.
    /// `total_stake` decreased by  max max(`amount`,`stakes` of key `caller`).
    /// `unstakes` of keys `(caller, unstakes_id.0..unstakes_id.1)` field amount decreased appropriately to cover rest of max(`amount` - `stakes`, 0) of slash.
    /// `total_unstake` decreased by appropriately
    /// [StakeTimesStorage]
    /// `stakes_timestamps` of key `caller` removed if `stakes` of key `caller` was removed.
    /// `last_stakes_timestamps` oof key `caller` removed if `stakes` of key `caller` was removed.
    fn slash(&mut self, account: AccountId, amount: Balance) -> Result<Balance, StakeError> {
        self._slash(&account, &amount)
    }
}

impl<
        T: Storage<StakeStorage>
            + Storage<StakeCounterStorage>
            + Storage<StakeTimesStorage>
            + Storage<TimestampMockStorage>
            + StakeTimesInternal
            + StakeCounterInternal
            + TimestampMockInternal
            + EmitStakeEvents,
    > StakeInternal for T
{
    fn _want(&self) -> AccountId {
        self.data::<StakeStorage>().want
    }
    fn _unstake_period(&self) -> Timestamp {
        self.data::<StakeStorage>().unstake_period
    }

    fn _maximal_number_of_unstakes(&self) -> u64 {
        self.data::<StakeStorage>().maximal_number_of_unstakes
    }

    fn _total_stake(&self) -> Balance {
        self.data::<StakeStorage>().total_stake
    }

    fn _total_unstake(&self) -> Balance {
        self.data::<StakeStorage>().total_unstake
    }

    fn _stake_of(&self, account: &AccountId) -> Option<Balance> {
        self.data::<StakeStorage>().stakes.get(account)
    }

    fn _stake_and_unstakes_initialized_after(&self, account: &AccountId, timestamp: &Timestamp) -> Balance {
        let mut stake_at = self.data::<StakeStorage>().stakes.get(account).unwrap_or_default();
        let unstakes = self._initialized_unstakes_of(account);

        for unstake in unstakes.iter().rev() {
            if unstake.init_time >= *timestamp {
                stake_at += unstake.amount;
            } else {
                break
            }
        }
        stake_at
    }

    /// # Storage modifications
    /// [StakeStorage]
    /// `stake` of key `account` increased by `amount`.
    /// `total_stake` increased by `amount`.
    /// [StakeTimesStorage]
    /// `stakes_timestamps` of key `account set to `block_timestamp` if None.
    /// `last_stakes_timestamps` of key account set to `block_timestamp`.
    fn _increase_stake_of(&mut self, account: &AccountId, amount: &Balance) -> Result<(), StakeError> {
        if *amount == 0 {
            return Err(StakeError::AmountIsZero)
        }
        // increase stake_of
        let new_stake = self
            ._stake_of(&account)
            .unwrap_or_default()
            .checked_add(*amount)
            .ok_or(MathError::Add)?;
        self.data::<StakeStorage>().stakes.insert(&account, &(new_stake));
        // increase total_stake
        let new_total_stake = self._total_stake().checked_add(*amount).ok_or(MathError::Add)?;

        self.data::<StakeStorage>().total_stake = new_total_stake;
        Ok(())
    }

    /// # Storage modifications
    /// [StakeStorage]
    /// `stake` of key `account` decreased by `amount`. If becomes 0 then remove.
    /// `total_stake` decreased by `amount`.
    /// [StakeTimesStorage]
    /// `stakes_timestamps` of key `account removed if stake` of key `account` was removed.
    /// `last_stakes_timestamps` of key account set removed if stake` of key `account` was removed.
    fn _decrease_stake_of(&mut self, account: &AccountId, amount: &Balance) -> Result<(), StakeError> {
        if *amount == 0 {
            return Err(StakeError::AmountIsZero)
        }
        let stake = self._stake_of(account).unwrap_or_default();
        if *amount > stake {
            return Err(StakeError::InsufficientStake)
        }

        let new_total_stake = self._total_stake().checked_sub(*amount).ok_or(MathError::Sub)?;
        self.data::<StakeStorage>().total_stake = new_total_stake;
        // decrease active_stake
        if *amount == stake {
            self.data::<StakeStorage>().stakes.remove(account);
        } else if *amount < stake {
            self.data::<StakeStorage>().stakes.insert(account, &(stake - *amount));
        }
        Ok(())
    }

    /// # Storage modifications
    /// [StakeStorage]
    /// `stake` of key `account` decreased by `amount`. If becomes 0 then remove.
    /// `total_stake` decreased by `amount`.
    /// [StakeTimesStorage]
    /// `stakes_timestamps` of key `account removed if stake` of key `account` was removed.
    /// `last_stakes_timestamps` of key account set removed if stake` of key `account` was removed.
    fn _decrease_unstakes_of(&mut self, account: &AccountId, amount: &Balance) -> Result<Balance, StakeError> {
        if *amount == 0 {
            return Err(StakeError::AmountIsZero)
        }
        let mut to_slash = *amount;
        let mut unstakes = self._initialized_unstakes_of(account);
        while unstakes.len() > 0 {
            let mut unstake = unstakes.pop().unwrap();

            if to_slash <= unstake.amount {
                unstake.amount -= to_slash;
                if unstake.amount != 0 {
                    unstakes.push(unstake);
                }
                to_slash = 0;
                break
            } else {
                to_slash -= unstake.amount;
            }
        }

        let new_total_unstake = self
            .data::<StakeStorage>()
            .total_unstake
            .checked_add(to_slash)
            .ok_or(MathError::Add)?
            .checked_sub(*amount)
            .ok_or(MathError::Sub)?;

        self.data::<StakeStorage>().total_unstake = new_total_unstake;
        if unstakes.len() > 0 {
            self.data::<StakeStorage>().unstakes.insert(account, &unstakes);
        } else {
            self.data::<StakeStorage>().unstakes.remove(account);
        }

        Ok(to_slash)
    }

    /// # Storage modifications
    /// [StakeStorage]
    /// `total_unstake` increased by `amount`.
    /// `unstakes` of key `(caller)` pushed at back of Vec Unstakes { `block_timestamp`, `amount`}.
    fn _register_unstake(&mut self, account: &AccountId, amount: &Balance) -> Result<(), StakeError> {
        let mut unstakes = self._initialized_unstakes_of(account);
        if unstakes.len() as u64 >= self._maximal_number_of_unstakes() {
            return Err(StakeError::ToManyUnstakes)
        }
        let timestamp = self._timestamp();
        unstakes.push(Unstake {
            init_time: timestamp,
            amount: *amount,
        });

        self.data::<StakeStorage>().unstakes.insert(account, &unstakes);

        let new_total_unstake = self
            .data::<StakeStorage>()
            .total_unstake
            .checked_add(*amount)
            .ok_or(MathError::Add)?;
        self.data::<StakeStorage>().total_unstake = new_total_unstake;

        Ok(())
    }

    /// # Storage modifications
    /// [StakeStorage]
    /// `total_unstake` decreased by aproperiate amount.
    /// `unstakes` of key `(caller)` pop front from Vec all Unstakes that are ready to unstake.
    fn _deregister_ready_unstakes(&mut self, account: &AccountId) -> Result<Balance, StakeError> {
        let unstakes = self._initialized_unstakes_of(account);
        if unstakes.len() == 0 {
            return Err(StakeError::NoInitializedUnstakes)
        }

        let mut amount: Balance = 0;
        let timestamp = self._timestamp();
        let unstake_period = self._unstake_period();
        if timestamp < unstakes[0].init_time + unstake_period {
            return Err(StakeError::TooEarly)
        }

        let mut index: usize = 0;
        while index < unstakes.len() && timestamp >= unstakes[index].init_time + unstake_period {
            amount += unstakes[index].amount;
            index += 1;
        }

        if index < unstakes.len() {
            self.data::<StakeStorage>()
                .unstakes
                .insert(account, &unstakes[index..].to_vec());
        } else {
            self.data::<StakeStorage>().unstakes.remove(account);
        }

        let new_total_unstake = self
            .data::<StakeStorage>()
            .total_unstake
            .checked_sub(amount)
            .ok_or(MathError::Sub)?;
        self.data::<StakeStorage>().total_unstake = new_total_unstake;

        Ok(amount)
    }

    fn _initialized_unstakes_of(&self, account: &AccountId) -> Vec<Unstake> {
        self.data::<StakeStorage>().unstakes.get(account).unwrap_or_default()
    }

    /// # Storage modifications
    /// [StakeStorage]
    /// `stake` of key `account` increased by `amount`.
    /// `total_stake` increased by `amount`.
    /// [StakeCounterStorage]
    /// `counter_stake` increased by `amount`.
    fn _reward(&mut self, account: &AccountId, amount: &Balance) -> Result<(), StakeError> {
        self._increase_stake_of(&account, &amount)?;
        self._increase_counter(&amount);
        self._on_reward(&amount)?;
        self._emit_rewarded_event(&account, &amount);
        Ok(())
    }

    /// # Storage modifications
    /// [StakeStorage]
    /// `stakes` of key `caller` decreased by max(`amount`,`stakes` of key `caller`). Ig becomes 0 then remove.
    /// `total_stake` decreased by max max(`amount`,`stakes` of key `caller`).
    /// `unstakes` of keys `(caller, unstakes_id.0..unstakes_id.1)` field amount decreased appropriately to cover rest of max(`amount` - `stakes`, 0) of slash.
    /// `total_unstake` decreased by appropriately
    /// [StakeTimesStorage]
    /// `stakes_timestamps` of key `caller` removed if `stakes` of key `caller` was removed.
    /// `last_stakes_timestamps` oof key `caller` removed if `stakes` of key `caller` was removed.
    fn _slash(&mut self, account: &AccountId, amount: &Balance) -> Result<Balance, StakeError> {
        let stake = self._stake_of(&account).unwrap_or_default();
        if stake >= *amount {
            self._decrease_stake_of(&account, &amount)?;
            if stake == *amount {
                self._remove_stake_timestamps_of(&account);
            }
            self._emit_slashed_event(&account, &(amount));
            return Ok(*amount)
        }
        if stake > 0 {
            self._decrease_stake_of(&account, &stake)?;
            self._remove_stake_timestamps_of(&account);
        }

        let amount_not_slashed = self._decrease_unstakes_of(&account, &(amount - stake))?;
        if *amount - amount_not_slashed > 0 {
            self._emit_slashed_event(&account, &(amount - amount_not_slashed));
        } else {
            return Err(StakeError::StakeIsZero)
        }
        Ok(amount - amount_not_slashed)
    }

    /// # Storage modifications
    /// [StakeStorage]
    /// `unstake_period` set to `unstake_period`
    fn _change_unstake_period(&mut self, unstake_period: &Timestamp) -> Result<(), StakeError> {
        if self.data::<StakeStorage>().unstake_period != *unstake_period {
            self.data::<StakeStorage>().unstake_period = *unstake_period;
            self._emit_unstake_period_changed_event(&unstake_period);
        }
        Ok(())
    }

    /// # Storage modifications
    /// [StakeStorage]
    /// `maximal_number_of_unstakes` set to `maximal_number_of_unstakes`
    fn _change_maximal_number_of_unstakes(&mut self, maximal_number_of_unstakes: &u64) -> Result<(), StakeError> {
        if self.data::<StakeStorage>().maximal_number_of_unstakes != *maximal_number_of_unstakes {
            self.data::<StakeStorage>().maximal_number_of_unstakes = *maximal_number_of_unstakes;
            self._emit_maximal_number_of_unstakes_changed_event(&maximal_number_of_unstakes);
        }
        Ok(())
    }
}

impl<T: Storage<StakeTimesStorage> + Storage<TimestampMockStorage> + TimestampMockInternal> StakeTimesInternal for T {
    fn _stake_timestamp_of(&self, account: &AccountId) -> Option<Timestamp> {
        self.data::<StakeTimesStorage>().stakes_timestamps.get(account)
    }

    fn _last_stake_timestamp_of(&self, account: &AccountId) -> Option<Timestamp> {
        self.data::<StakeTimesStorage>().last_stakes_timestamps.get(account)
    }

    /// # Storage modifications
    /// [StakeTimesStorage]
    /// `stakes_timestamps` set to `block_timestamp` if was None.
    /// `last_stakes_timestamps` set to `block_timestamp`..
    fn _update_stake_timestamps_of(&mut self, account: &AccountId) {
        let timestamp = self._timestamp();
        if self._stake_timestamp_of(account).is_none() {
            self.data::<StakeTimesStorage>()
                .stakes_timestamps
                .insert(account, &timestamp);
        }
        self.data::<StakeTimesStorage>()
            .last_stakes_timestamps
            .insert(account, &timestamp);
    }

    /// # Storage modifications
    /// [StakeTimesStorage]
    /// `stakes_timestamps` removed.
    /// `last_stakes_timestamps` removed.
    fn _remove_stake_timestamps_of(&mut self, account: &AccountId) {
        self.data::<StakeTimesStorage>().stakes_timestamps.remove(account);
        self.data::<StakeTimesStorage>().last_stakes_timestamps.remove(account);
    }
}

impl<T: Storage<StakeCounterStorage>> StakeCounterInternal for T {
    fn _counter_stake(&self) -> Balance {
        self.data::<StakeCounterStorage>().counter_stake
    }

    /// # Storage modifications
    /// [StakeCounterStorage]
    /// `counter_stake` increased by `amount`.
    fn _increase_counter(&mut self, amount: &Balance) {
        // allow overflows
        let new_counter_stake = self
            .data::<StakeCounterStorage>()
            .counter_stake
            .overflowing_add(*amount);

        self.data::<StakeCounterStorage>().counter_stake = new_counter_stake.0;
    }
}

impl<T: Storage<StakeStorage> + StakeInternal> StakeTransfer for T {
    fn _transfer_in(&self, account: &AccountId, amount: &Balance) -> Result<(), StakeError> {
        PSP22Ref::transfer_from_builder(
            &self._want(),
            *account,
            Self::env().account_id(),
            *amount,
            Vec::<u8>::new(),
        )
        .call_flags(ink::env::CallFlags::default().set_allow_reentry(true))
        .try_invoke()
        .unwrap()??;
        Ok(())
    }

    /// Transfers `want` tokens from self to `account`.
    fn _transfer_out(&self, account: &AccountId, amount: &Balance) -> Result<(), StakeError> {
        PSP22Ref::transfer(&self._want(), *account, *amount, vec![])?;
        Ok(())
    }

    fn _on_reward(&self, amount: &Balance) -> Result<(), StakeError> {
        PSP22MintableRef::mint(&self._want(), Self::env().account_id(), *amount)?;
        Ok(())
    }

    fn _on_slash(&self, amount: &Balance) -> Result<(), StakeError> {
        PSP22BurnableRef::burn(&self._want(), Self::env().account_id(), *amount)?;
        Ok(())
    }
}

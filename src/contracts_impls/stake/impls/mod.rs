pub mod storage;

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

use self::storage::data::{
    StakeCounterStorage,
    StakeStorage,
    StakeTimesStorage,
};

pub const E12: u128 = 1_000_000_000_000;

pub trait StakeViewImpl: Storage<StakeStorage> + StakeInternal + StakeTransfer {
    fn want(&self) -> AccountId {
        self.data::<StakeStorage>().want
    }

    fn unstake_period(&self) -> Timestamp {
        self.data::<StakeStorage>().unstake_period
    }

    fn maximal_number_of_unstakes(&self) -> u64 {
        self.data::<StakeStorage>().maximal_number_of_unstakes
    }

    fn total_stake(&self) -> Balance {
        self.data::<StakeStorage>().total_stake
    }

    fn total_unstake(&self) -> Balance {
        self.data::<StakeStorage>().total_unstake
    }
    fn stake_of(&self, account: AccountId) -> Balance {
        self.data::<StakeStorage>().stake_of(&account)
    }

    fn stake_and_unstakes_initialized_after(&self, account: AccountId, timestamp: Timestamp) -> Balance {
        self.data::<StakeStorage>()
            .stake_and_unstakes_initialized_after(&account, &timestamp)
    }
    fn initialized_unstakes_of(&self, account: AccountId) -> Vec<Unstake> {
        self.data::<StakeStorage>().initialized_unstakes_of(&account)
    }
}

pub trait StakeImpl:
    Storage<StakeStorage>
    + StakeInternal
    + EmitStakeEvents
    + Storage<StakeTimesStorage>
    + Storage<StakeCounterStorage>
    + Storage<TimestampMockStorage>
    + TimestampMockInternal
{
    fn stake(&mut self, amount: Balance) -> Result<(), StakeError> {
        if amount == 0 {
            return Err(StakeError::AmountIsZero)
        }
        let caller = Self::env().caller();
        let timestamp = self._timestamp();
        self._transfer_in(&caller, &amount)?;
        self.data::<StakeTimesStorage>()
            .update_stake_timestamps_of(&caller, &timestamp);
        self.data::<StakeStorage>().increase_stake_of(&caller, &amount)?;
        self.data::<StakeStorage>().increase_total_stake(&amount)?;
        self.data::<StakeCounterStorage>().increase_counter(&amount);

        self._emit_staked_event(&caller, &amount);
        Ok(())
    }

    fn initialize_unstake(&mut self, amount: Balance) -> Result<(), StakeError> {
        if amount == 0 {
            return Err(StakeError::AmountIsZero)
        }
        let caller = Self::env().caller();

        let stake_is_zero = self.data::<StakeStorage>().decrease_stake_of(&caller, &amount)?;
        self.data::<StakeStorage>().decrease_total_stake(&amount)?;

        if stake_is_zero {
            self.data::<StakeTimesStorage>().remove_stake_timestamps_of(&caller);
        }
        let timestamp = self._timestamp();
        self.data::<StakeStorage>()
            .register_unstake(&caller, &amount, &timestamp)?;

        self._emit_initialized_unstake_event(&caller, &amount);
        Ok(())
    }

    fn unstake(&mut self) -> Result<Balance, StakeError> {
        let caller = Self::env().caller();

        let timestamp = self._timestamp();

        let amount = self
            .data::<StakeStorage>()
            .deregister_ready_unstakes(&caller, &timestamp)?;

        self._transfer_out(&caller, &amount)?;

        self._emit_unstake_event(&caller);

        Ok(amount)
    }
}

pub trait StakeCounterImpl: Storage<StakeCounterStorage> {
    fn counter_stake(&self) -> Balance {
        self.data::<StakeCounterStorage>().counter_stake
    }
}

pub trait StakeTimesImpl: Storage<StakeTimesStorage> {
    fn stake_timestamp_of(&self, account: AccountId) -> Option<Timestamp> {
        self.data::<StakeTimesStorage>().stake_timestamp_of(&account)
    }

    fn last_stake_timestamp_of(&self, account: AccountId) -> Option<Timestamp> {
        self.data::<StakeTimesStorage>().last_stake_timestamp_of(&account)
    }
}

pub trait StakeManageImpl: Storage<StakeStorage> + Storage<ownable::Data> + StakeInternal + EmitStakeEvents {
    /// # Storage modifications
    /// [StakeStorage]
    /// `unstake_period` set to `unstake_period`

    // #[modifiers(only_owner())]
    fn change_unstake_period(&mut self, unstake_period: Timestamp) -> Result<(), StakeError> {
        self.data::<StakeStorage>().change_unstake_period(&unstake_period);
        self._emit_unstake_period_changed_event(&unstake_period);
        Ok(())
    }

    /// # Storage modifications
    /// [StakeStorage]
    /// `maximal_number_of_unstakes` set to `maximal_number_of_unstakes`

    // #[modifiers(only_owner())]
    fn change_maximal_number_of_unstakes(&mut self, maximal_number_of_unstakes: u64) -> Result<(), StakeError> {
        self.data::<StakeStorage>()
            .change_maximal_number_of_unstakes(&maximal_number_of_unstakes);
        self._emit_maximal_number_of_unstakes_changed_event(&maximal_number_of_unstakes);
        Ok(())
    }
}
pub trait StakeRewardableImpl:
    Storage<StakeStorage>
    + StakeInternal
    + Storage<StakeCounterStorage>
    + Storage<TimestampMockStorage>
    + TimestampMockInternal
{
    /// # Storage modifications
    /// [StakeStorage]
    /// `stakes` of key `caller` increased by `amount`
    /// `total_stake` increased by `amount`
    /// [StakeCounterStorage]
    /// `counter` - increased by amount
    fn reward(&mut self, account: AccountId, amount: Balance) -> Result<(), StakeError> {
        if amount == 0 {
            return Err(StakeError::AmountIsZero)
        }
        self._reward(&account, &amount)?;
        Ok(())
    }
}

pub trait StakeSlashableImpl:
    Storage<StakeStorage>
    + StakeInternal
    + Storage<StakeTimesStorage>
    + Storage<TimestampMockStorage>
    + TimestampMockInternal
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
        if amount == 0 {
            return Err(StakeError::AmountIsZero)
        }
        self._slash(&account, &amount)
    }
}

impl<
        T: Storage<StakeStorage>
            + Storage<StakeCounterStorage>
            + Storage<StakeTimesStorage>
            + Storage<TimestampMockStorage>
            + TimestampMockInternal
            + EmitStakeEvents,
    > StakeInternal for T
{
    /// # Storage modifications
    /// [StakeStorage]
    /// `stake` of key `account` increased by `amount`.
    /// `total_stake` increased by `amount`.
    /// [StakeCounterStorage]
    /// `counter_stake` increased by `amount`.
    fn _reward(&mut self, account: &AccountId, amount: &Balance) -> Result<(), StakeError> {
        self.data::<StakeStorage>().increase_stake_of(&account, &amount)?;
        self.data::<StakeStorage>().increase_total_stake(&amount)?;

        self.data::<StakeCounterStorage>().increase_counter(&amount);
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
        ink::env::debug_println!("amount to slash: {}", amount);
        let stake = self.data::<StakeStorage>().stake_of(&account);
        ink::env::debug_println!("stake of: {}", stake);
        ink::env::debug_println!("total stake: {}", self.data::<StakeStorage>().total_stake);
        if stake >= *amount {
            let stake_is_zero = self.data::<StakeStorage>().decrease_stake_of(account, amount)?;
            ink::env::debug_println!("m1");
            self.data::<StakeStorage>().decrease_total_stake(amount)?;
            ink::env::debug_println!("m2");
            if stake_is_zero {
                self.data::<StakeTimesStorage>().remove_stake_timestamps_of(&account);
            }
            self._emit_slashed_event(&account, &(amount));
            return Ok(*amount)
        } else {
            if stake > 0 {
                self.data::<StakeStorage>().decrease_stake_of(&account, &stake)?;
                self.data::<StakeStorage>().decrease_total_stake(&stake)?;
                self.data::<StakeTimesStorage>().remove_stake_timestamps_of(&account);
            }
            let unstake_amount_slashed = self
                .data::<StakeStorage>()
                .decrease_unstakes_of(&account, &(amount - stake));
            self.data::<StakeStorage>()
                .decrease_total_unstake(&unstake_amount_slashed)?;

            if unstake_amount_slashed + stake == 0 {
                return Err(StakeError::StakeIsZero)
            } else {
                self._emit_slashed_event(&account, &(unstake_amount_slashed + stake));
                Ok(unstake_amount_slashed + stake)
            }
        }
    }
}

impl<T: Storage<StakeStorage> + StakeInternal> StakeTransfer for T {
    fn _transfer_in(&self, account: &AccountId, amount: &Balance) -> Result<(), StakeError> {
        PSP22Ref::transfer_from_builder(
            &self.data::<StakeStorage>().want,
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
        PSP22Ref::transfer(&self.data::<StakeStorage>().want, *account, *amount, vec![])?;
        Ok(())
    }

    fn _on_reward(&self, amount: &Balance) -> Result<(), StakeError> {
        PSP22MintableRef::mint(&self.data::<StakeStorage>().want, Self::env().account_id(), *amount)?;
        Ok(())
    }

    fn _on_slash(&self, amount: &Balance) -> Result<(), StakeError> {
        PSP22BurnableRef::burn(&self.data::<StakeStorage>().want, Self::env().account_id(), *amount)?;
        Ok(())
    }
}

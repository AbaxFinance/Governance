use openbrush::{
    storage::Mapping,
    traits::{
        AccountId,
        Balance,
        Timestamp,
    },
};

use crate::contracts_impls::stake::traits::*;

#[derive(Debug)]
#[openbrush::storage_item]
pub struct StakeStorage {
    // immuatables
    pub want: AccountId,
    // parameters
    pub unstake_period: Timestamp,
    pub maximal_number_of_unstakes: u64,
    // data
    // stakes
    pub total_stake: Balance,
    pub stakes: Mapping<AccountId, Balance>,
    // unstakes
    pub total_unstake: Balance,
    pub unstakes: Mapping<AccountId, Vec<Unstake>>,
}

impl Default for StakeStorage {
    fn default() -> Self {
        Self {
            want: [0; 32].into(),
            unstake_period: Default::default(),
            maximal_number_of_unstakes: Default::default(),
            total_stake: Default::default(),
            total_unstake: Default::default(),
            stakes: Default::default(),
            unstakes: Default::default(),
        }
    }
}

impl StakeStorage {
    pub fn stake_of(&self, account: &AccountId) -> Balance {
        self.stakes.get(account).unwrap_or_default()
    }

    pub fn initialized_unstakes_of(&self, account: &AccountId) -> Vec<Unstake> {
        self.unstakes.get(account).unwrap_or_default()
    }
    pub fn change_unstake_period(&mut self, unstake_period: &Timestamp) {
        if self.unstake_period != *unstake_period {
            self.unstake_period = *unstake_period;
        }
    }

    pub fn change_maximal_number_of_unstakes(&mut self, maximal_number_of_unstakes: &u64) {
        if self.maximal_number_of_unstakes != *maximal_number_of_unstakes {
            self.maximal_number_of_unstakes = *maximal_number_of_unstakes;
        }
    }

    pub fn increase_total_stake(&mut self, amount: &Balance) -> Result<(), MathError> {
        let new_total_stake = self.total_stake.checked_add(*amount).ok_or(MathError::Add)?;
        self.total_stake = new_total_stake;
        Ok(())
    }

    pub fn decrease_total_stake(&mut self, amount: &Balance) -> Result<(), MathError> {
        ink::env::debug_println!("total stake: {}  | amount: {}", self.total_stake, amount);
        let new_total_stake = self.total_stake.checked_sub(*amount).ok_or(MathError::Sub)?;
        ink::env::debug_println!("mm");
        self.total_stake = new_total_stake;
        Ok(())
    }

    pub fn increase_total_unstake(&mut self, amount: &Balance) -> Result<(), MathError> {
        let new_total_unstake = self.total_unstake.checked_add(*amount).ok_or(MathError::Add)?;
        self.total_unstake = new_total_unstake;
        Ok(())
    }

    pub fn decrease_total_unstake(&mut self, amount: &Balance) -> Result<(), MathError> {
        let new_total_unstake = self.total_unstake.checked_sub(*amount).ok_or(MathError::Sub)?;
        self.total_unstake = new_total_unstake;
        Ok(())
    }

    pub fn increase_stake_of(&mut self, account: &AccountId, amount: &Balance) -> Result<(), MathError> {
        let new_stake = self.stake_of(&account).checked_add(*amount).ok_or(MathError::Add)?;
        self.stakes.insert(account, &new_stake);
        Ok(())
    }

    pub fn decrease_stake_of(&mut self, account: &AccountId, amount: &Balance) -> Result<bool, StakeError> {
        let stake = self.stake_of(account);
        if *amount > stake {
            return Err(StakeError::InsufficientStake)
        }
        let new_stake = stake - *amount;
        if new_stake == 0 {
            self.stakes.remove(account);
        } else if *amount < stake {
            self.stakes.insert(account, &(new_stake));
        }
        Ok(new_stake == 0)
    }

    // decrease up to amount from user unstakes
    // rerutns amount slashed.
    pub fn decrease_unstakes_of(&mut self, account: &AccountId, amount: &Balance) -> Balance {
        let mut to_slash = *amount;
        let mut unstakes = self.initialized_unstakes_of(account);
        while !unstakes.is_empty() {
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

        if unstakes.len() > 0 {
            self.unstakes.insert(account, &unstakes);
        } else {
            self.unstakes.remove(account);
        }

        amount - to_slash
    }

    pub fn stake_and_unstakes_initialized_after(&self, account: &AccountId, timestamp: &Timestamp) -> Balance {
        let mut stake_and_unstakes = self.stake_of(&account);
        let unstakes = self.initialized_unstakes_of(account);

        for unstake in unstakes.iter().rev() {
            if unstake.init_time >= *timestamp {
                stake_and_unstakes += unstake.amount;
            } else {
                break
            }
        }
        stake_and_unstakes
    }

    pub fn register_unstake(
        &mut self,
        account: &AccountId,
        amount: &Balance,
        timestamp: &Timestamp,
    ) -> Result<(), StakeError> {
        let mut unstakes = self.initialized_unstakes_of(account);
        if unstakes.len() as u64 >= self.maximal_number_of_unstakes {
            return Err(StakeError::ToManyUnstakes)
        }
        unstakes.push(Unstake {
            init_time: *timestamp,
            amount: *amount,
        });

        self.unstakes.insert(account, &unstakes);

        self.increase_total_unstake(amount)?;
        Ok(())
    }

    pub fn deregister_ready_unstakes(
        &mut self,
        account: &AccountId,
        timestamp: &Timestamp,
    ) -> Result<Balance, StakeError> {
        let unstakes = self.initialized_unstakes_of(account);
        if unstakes.len() == 0 {
            return Err(StakeError::NoInitializedUnstakes)
        }

        let mut amount: Balance = 0;
        let unstake_period = self.unstake_period;
        if *timestamp < unstakes[0].init_time + unstake_period {
            return Err(StakeError::TooEarly)
        }

        let mut index: usize = 0;
        while index < unstakes.len() && *timestamp >= unstakes[index].init_time + unstake_period {
            amount += unstakes[index].amount;
            index += 1;
        }

        if index < unstakes.len() {
            self.unstakes.insert(account, &unstakes[index..].to_vec());
        } else {
            self.unstakes.remove(account);
        }

        self.decrease_total_unstake(&amount)?;

        Ok(amount)
    }
}

#[derive(Debug, Default)]
#[openbrush::storage_item]
pub struct StakeTimesStorage {
    pub stakes_timestamps: Mapping<AccountId, Timestamp>,
    pub last_stakes_timestamps: Mapping<AccountId, Timestamp>,
}

impl StakeTimesStorage {
    pub fn stake_timestamp_of(&self, account: &AccountId) -> Option<Timestamp> {
        self.stakes_timestamps.get(account)
    }

    pub fn last_stake_timestamp_of(&self, account: &AccountId) -> Option<Timestamp> {
        self.last_stakes_timestamps.get(account)
    }

    pub fn update_stake_timestamps_of(&mut self, account: &AccountId, timestamp: &Timestamp) {
        if self.stake_timestamp_of(account).is_none() {
            self.stakes_timestamps.insert(account, &timestamp);
        }
        self.last_stakes_timestamps.insert(account, &timestamp);
    }

    pub fn remove_stake_timestamps_of(&mut self, account: &AccountId) {
        self.stakes_timestamps.remove(account);
        self.last_stakes_timestamps.remove(account);
    }
}

pub const STORAGE_KEY2: u32 = openbrush::storage_unique_key!(StakeCounterStorage);
#[derive(Debug, Default)]
#[openbrush::storage_item]
pub struct StakeCounterStorage {
    pub counter_stake: Balance,
}

impl StakeCounterStorage {
    pub fn increase_counter(&mut self, amount: &Balance) {
        // allow overflows
        let new_counter_stake = self.counter_stake.overflowing_add(*amount);

        self.counter_stake = new_counter_stake.0;
    }
}

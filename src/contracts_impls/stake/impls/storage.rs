use openbrush::{
    storage::Mapping,
    traits::{AccountId, Balance, Timestamp},
};

use crate::contracts_impls::stake::traits::*;

pub const STORAGE_KEY: u32 = openbrush::storage_unique_key!(StakeStorage);
#[derive(Debug)]
#[openbrush::upgradeable_storage(STORAGE_KEY)]
pub struct StakeStorage {
    //immuatables
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

pub const STORAGE_KEY1: u32 = openbrush::storage_unique_key!(StakeTimesStorage);
#[derive(Debug, Default)]
#[openbrush::upgradeable_storage(STORAGE_KEY1)]
pub struct StakeTimesStorage {
    pub stakes_timestamps: Mapping<AccountId, Timestamp>,
    pub last_stakes_timestamps: Mapping<AccountId, Timestamp>,
}

pub const STORAGE_KEY2: u32 = openbrush::storage_unique_key!(StakeCounterStorage);
#[derive(Debug, Default)]
#[openbrush::upgradeable_storage(STORAGE_KEY2)]
pub struct StakeCounterStorage {
    pub counter_stake: Balance,
}

use openbrush::traits::{
    Balance,
    Timestamp,
};
use scale::{
    Decode,
    Encode,
};

#[derive(Debug, Clone, Copy, PartialEq, Encode, Decode, Default)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout))]

/// Represents the initialized by an account unstake of `amount` started at `init_time`.
pub struct Unstake {
    /// timestamp of unstake initialization.
    pub init_time: Timestamp,
    /// amount initialized for unstaking.
    pub amount: Balance,
}

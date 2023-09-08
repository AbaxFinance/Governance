#![cfg_attr(not(feature = "std"), no_std, no_main)]
#![feature(min_specialization)]

#[openbrush::contract]
pub mod block_timestamp_provider {
    use abax_governance::contracts_impls::timestamp_mock::traits::*;
    use openbrush::{
        contracts::ownable::{
            OwnableError,
            *,
        },
        modifiers,
        traits::{
            DefaultEnv,
            Storage,
        },
    };

    #[ink(storage)]
    #[derive(Default, Storage)]
    pub struct BlockTimestampProvider {
        #[storage_field]
        ownable: ownable::Data,
        should_return_mock_value: bool,
        mock_timestamp: u64,
    }

    impl BlockTimestampProvider {
        #[ink(constructor)]
        pub fn new(init_should_return_mock_value: bool, owner: AccountId) -> Self {
            let mut instance = Self::default();
            instance.should_return_mock_value = init_should_return_mock_value;
            instance.mock_timestamp = Default::default();
            instance._init_with_owner(owner);
            instance
        }
    }

    impl Ownable for BlockTimestampProvider {}

    impl BlockTimestampProviderInterface for BlockTimestampProvider {
        #[ink(message)]
        fn get_block_timestamp(&self) -> u64 {
            if self.should_return_mock_value {
                return self.mock_timestamp
            }
            return Self::env().block_timestamp()
        }
        #[ink(message)]
        #[modifiers(only_owner)]
        fn set_block_timestamp(&mut self, timestamp: u64) -> Result<(), OwnableError> {
            self.mock_timestamp = timestamp;
            Ok(())
        }
        #[ink(message)]
        #[modifiers(only_owner)]
        fn increase_block_timestamp(&mut self, delta_timestamp: u64) -> Result<(), OwnableError> {
            self.mock_timestamp += delta_timestamp;
            Ok(())
        }
        #[ink(message)]
        #[modifiers(only_owner)]
        fn set_should_return_mock_value(&mut self, should_return_mock_value: bool) -> Result<(), OwnableError> {
            self.should_return_mock_value = should_return_mock_value;
            Ok(())
        }
        #[ink(message)]
        fn get_should_return_mock_value(&self) -> bool {
            self.should_return_mock_value
        }
    }
}

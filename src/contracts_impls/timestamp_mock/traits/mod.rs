use openbrush::{
    contracts::ownable::OwnableError,
    traits::{
        AccountId,
        Timestamp,
    },
};

#[ink::trait_definition]
pub trait TimestampMock {
    #[ink(message)]
    fn set_timestamp_provider(&mut self, account: AccountId);

    #[ink(message)]
    fn timestamp_provider(&self) -> AccountId;

    #[ink(message)]
    fn timestamp(&self) -> Timestamp;
}

#[openbrush::wrapper]
pub type BlockTimestampProviderRef = dyn BlockTimestampProviderInterface;

#[openbrush::trait_definition]
pub trait BlockTimestampProviderInterface {
    #[ink(message)]
    fn get_block_timestamp(&self) -> u64;
    #[ink(message)]
    fn set_block_timestamp(&mut self, timestamp: u64) -> Result<(), OwnableError>;
    #[ink(message)]
    fn increase_block_timestamp(&mut self, delta_timestamp: u64) -> Result<(), OwnableError>;
    #[ink(message)]
    fn set_should_return_mock_value(&mut self, should_return_mock_value: bool) -> Result<(), OwnableError>;
    #[ink(message)]
    fn get_should_return_mock_value(&self) -> bool;
}

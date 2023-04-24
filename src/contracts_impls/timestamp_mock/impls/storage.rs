use openbrush::traits::AccountId;

pub const STORAGE_KEY: u32 = openbrush::storage_unique_key!(TimestampMockStorage);
#[derive(Debug)]
#[openbrush::upgradeable_storage(STORAGE_KEY)]
pub struct TimestampMockStorage {
    //immuatables
    pub timestamp_provider: AccountId,
}

impl Default for TimestampMockStorage {
    fn default() -> Self {
        Self {
            timestamp_provider: [0; 32].into(),
        }
    }
}

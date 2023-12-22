use openbrush::traits::AccountId;

#[derive(Debug)]
#[openbrush::storage_item]
pub struct TimestampMockStorage {
    // immuatables
    pub timestamp_provider: AccountId,
}

impl Default for TimestampMockStorage {
    fn default() -> Self {
        Self {
            timestamp_provider: [0; 32].into(),
        }
    }
}

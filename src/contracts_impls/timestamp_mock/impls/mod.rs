pub mod storage;
pub use storage::*;

use crate::contracts_impls::timestamp_mock::traits::*;

use openbrush::traits::{
    AccountId,
    Storage,
    Timestamp,
};
impl<T: Storage<TimestampMockStorage>> TimestampMock for T {
    fn set_timestamp_provider(&mut self, account: AccountId) {
        self.data::<TimestampMockStorage>().timestamp_provider = account;
    }

    fn timestamp_provider(&self) -> AccountId {
        self._timestamp_provider()
    }

    fn timestamp(&self) -> Timestamp {
        self._timestamp()
    }
}

pub trait TimestampMockInternal {
    fn _timestamp_provider(&self) -> AccountId;
    fn _timestamp(&self) -> Timestamp;
}

impl<T: Storage<TimestampMockStorage>> TimestampMockInternal for T {
    default fn _timestamp_provider(&self) -> AccountId {
        self.data::<TimestampMockStorage>().timestamp_provider
    }
    default fn _timestamp(&self) -> Timestamp {
        BlockTimestampProviderRef::get_block_timestamp(&self._timestamp_provider())
    }
}

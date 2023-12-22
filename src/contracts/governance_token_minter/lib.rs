#![cfg_attr(not(feature = "std"), no_std, no_main)]
#![feature(min_specialization)]

#[openbrush::contract]
pub mod psp22_emitable {

    use openbrush::{
        contracts::{
            ownable::*,
            psp22::{
                extensions::mintable::PSP22MintableRef,
                PSP22Error,
            },
        },
        storage::Mapping,
        traits::{
            Storage,
            ZERO_ADDRESS,
        },
    };

    #[ink(storage)]
    #[derive(Storage)]
    pub struct GovernanceTokenMinter {
        #[storage_field]
        ownable: ownable::Data,
        already_minted: Mapping<AccountId, ()>,
        gov_token_address: AccountId,
    }

    impl Default for GovernanceTokenMinter {
        fn default() -> Self {
            Self {
                ownable: Default::default(),
                already_minted: Default::default(),
                gov_token_address: ZERO_ADDRESS.into(),
            }
        }
    }

    impl GovernanceTokenMinter {
        #[ink(constructor)]
        pub fn new(gov_token_adrress: AccountId) -> Self {
            let mut instance = Self::default();
            let caller = instance.env().caller();
            instance._init_with_owner(caller);
            instance.gov_token_address = gov_token_adrress;
            instance
        }

        #[ink(message)]
        pub fn mint(&mut self) -> Result<(), GovernanceTokenMinterError> {
            let caller = self.env().caller();
            let amount = 10_000 * 1_000_000_000_000_u128;
            if !self.already_minted.contains(&caller) {
                PSP22MintableRef::mint(&self.gov_token_address, caller, amount)?;
                self.already_minted.insert(&caller, &());
            } else {
                return Err(GovernanceTokenMinterError::AlreadyMinted)
            }
            Ok(())
        }

        #[ink(message)]
        pub fn has_already_minted(&self, account: AccountId) -> bool {
            self.already_minted.contains(&account)
        }
    }

    #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum GovernanceTokenMinterError {
        OwnableError(OwnableError),
        PSP22Error(PSP22Error),

        AlreadyMinted,
    }

    impl From<OwnableError> for GovernanceTokenMinterError {
        fn from(error: OwnableError) -> Self {
            GovernanceTokenMinterError::OwnableError(error)
        }
    }
    impl From<PSP22Error> for GovernanceTokenMinterError {
        fn from(error: PSP22Error) -> Self {
            GovernanceTokenMinterError::PSP22Error(error)
        }
    }
}

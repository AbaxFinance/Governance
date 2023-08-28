#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[openbrush::implementation(Ownable)]
#[openbrush::contract]
pub mod governance_token_minter {

    use openbrush::{
        contracts::{
            ownable::*,
            psp22::{extensions::mintable::PSP22MintableRef, PSP22Error},
        },
        storage::Mapping,
        traits::Storage,
    };

    use ink::prelude::vec::Vec;

    #[ink(storage)]
    #[derive(Default, Storage)]
    pub struct GovernanceTokenMinter {
        #[storage_field]
        ownable: ownable::Data,
        gov_token_address: AccountId,
        already_minted: Mapping<AccountId, bool>,
    }

    impl GovernanceTokenMinter {
        #[ink(constructor)]
        pub fn new() -> Self {
            let mut instance = Self::default();
            let caller = instance.env().caller();
            ownable::Internal::_init_with_owner(&mut instance, caller);
            instance
        }

        #[ink(message)]
        pub fn mint(
            &mut self,
            to: AccountId,
            amount: Balance,
        ) -> Result<(), GovernanceTokenMinterError> {
            if !self.already_minted.contains(&to) {
                PSP22MintableRef::mint(&self.gov_token_address, to, amount)?;
                self.already_minted.insert(&to, &true);
            } else {
                return Err(GovernanceTokenMinterError::AlreadyMinted);
            }
            Ok(())
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

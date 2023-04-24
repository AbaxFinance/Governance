#![cfg_attr(not(feature = "std"), no_std)]
#![feature(min_specialization)]
#[openbrush::contract]
pub mod governance_token {
    // imports from ink!
    use ink::codegen::{EmitEvent, Env};

    // imports from openbrush
    use openbrush::traits::Storage;
    use openbrush::traits::String;
    use openbrush::{
        contracts::{
            access_control::{RoleType, *},
            psp22::{
                extensions::{burnable::*, metadata::*, mintable::*},
                PSP22Error,
            },
        },
        modifiers,
    };

    #[ink(storage)]
    #[derive(Default, Storage)]
    pub struct GovernanceToken {
        #[storage_field]
        psp22: psp22::Data,
        #[storage_field]
        metadata: metadata::Data,
        #[storage_field]
        access: access_control::Data,
    }
    const MINTER: RoleType = ink::selector_id!("MINTER"); // 4_254_773_782
    const BURNER: RoleType = ink::selector_id!("BURNER"); // 1_711_057_910

    // Section contains default implementation without any modifications
    impl AccessControl for GovernanceToken {}
    impl PSP22 for GovernanceToken {}
    impl PSP22Metadata for GovernanceToken {}

    impl PSP22Mintable for GovernanceToken {
        #[ink(message)]
        #[modifiers(only_role(MINTER))]
        fn mint(&mut self, account: AccountId, amount: Balance) -> Result<(), PSP22Error> {
            self._mint_to(account, amount)?;
            Ok(())
        }
    }
    impl PSP22Burnable for GovernanceToken {
        #[ink(message)]
        #[modifiers(only_role(BURNER))]
        fn burn(&mut self, account: AccountId, amount: Balance) -> Result<(), PSP22Error> {
            self._burn_from(account, amount)?;
            Ok(())
        }
    }

    impl GovernanceToken {
        #[ink(constructor)]
        pub fn new(
            initial_supply: Balance,
            name: Option<String>,
            symbol: Option<String>,
            decimal: u8,
        ) -> Self {
            let mut _instance = Self::default();
            _instance
                ._mint_to(_instance.env().caller(), initial_supply)
                .expect("Should mint");
            _instance.access._init_with_admin(_instance.env().caller());
            _instance.metadata.name = name;
            _instance.metadata.symbol = symbol;
            _instance.metadata.decimals = decimal;
            _instance
        }
    }

    #[ink(event)]
    pub struct Transfer {
        #[ink(topic)]
        from: Option<AccountId>,
        #[ink(topic)]
        to: Option<AccountId>,
        value: Balance,
    }

    #[ink(event)]
    pub struct Approval {
        #[ink(topic)]
        owner: AccountId,
        #[ink(topic)]
        spender: AccountId,
        value: Balance,
    }

    impl psp22::Internal for GovernanceToken {
        fn _emit_transfer_event(
            &self,
            _from: Option<AccountId>,
            _to: Option<AccountId>,
            _amount: Balance,
        ) {
            self.env().emit_event(Transfer {
                from: _from,
                to: _to,
                value: _amount,
            });
        }
        fn _emit_approval_event(&self, _owner: AccountId, _spender: AccountId, _amount: Balance) {
            self.env().emit_event(Approval {
                owner: _owner,
                spender: _spender,
                value: _amount,
            })
        }
    }
}

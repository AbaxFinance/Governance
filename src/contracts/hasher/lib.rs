#![cfg_attr(not(feature = "std"), no_std, no_main)]
#![feature(min_specialization)]
#[openbrush::contract]
pub mod hasher {

    use abax_governance::contracts_impls::{
        govern::traits::Proposal,
        stake::traits::*,
    };

    // imports from ink!
    use ink::{
        env::hash::Blake2x256,
        prelude::vec,
    };
    // imports from openbrush
    use openbrush::traits::{
        Storage,
        String,
    };

    #[ink(storage)]
    #[derive(Default, Storage)]
    pub struct Hasher {}

    impl Hasher {
        #[ink(constructor)]
        pub fn new() -> Self {
            Self::default()
        }

        #[ink(message)]
        pub fn hash_proposal_with_description(&self, proposal: Proposal, description: String) -> Hash {
            ink::env::debug_println!("hash_proposal_with_description | START");
            let description_hash = Self::env().hash_bytes::<Blake2x256>(&description.as_bytes());

            let mut hash_data: Vec<u8> = vec![];
            hash_data.append(&mut scale::Encode::encode(&proposal));
            hash_data.append(&mut scale::Encode::encode(&description_hash));

            let hash = Hash::try_from(Self::env().hash_bytes::<Blake2x256>(&hash_data)).unwrap();

            ink::env::debug_println!("{:?}", hash);
            ink::env::debug_println!("hash_proposal_with_description | STOP");
            hash
        }

        #[ink(message)]
        pub fn hash_proposal(&self, proposal: Proposal, description_hash: [u8; 32]) -> Hash {
            let mut hash_data: Vec<u8> = vec![];
            hash_data.append(&mut scale::Encode::encode(&proposal));
            hash_data.append(&mut scale::Encode::encode(&description_hash));

            let hash = Hash::try_from(Self::env().hash_bytes::<Blake2x256>(&hash_data)).unwrap();

            hash
        }

        #[ink(message)]
        pub fn hash_description(&self, description: String) -> [u8; 32] {
            Self::env().hash_bytes::<Blake2x256>(&description.as_bytes())
        }
    }
}

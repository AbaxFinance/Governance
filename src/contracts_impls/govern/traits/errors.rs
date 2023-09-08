use openbrush::contracts::{
    ownable::OwnableError,
    psp22::PSP22Error,
};
use scale::{
    Decode,
    Encode,
};

use crate::contracts_impls::stake::traits::{
    MathError,
    StakeError,
};

#[derive(Encode, Decode, Debug)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum GovernError {
    MathError(MathError),
    PSP22Error(PSP22Error),
    StakeError(StakeError),
    InnsuficientVotes,
    ProposalAlreadyExists,
    PropositionDeposit,
    NoSuchRule,
    ProposalDoesntExist,
    NotActive,
    FinalizeCondition,
    WrongStatus,
    UnderlyingTransactionReverted,
    TransferError,
    StillActive,
    RewardMultiplier,
    ZeroVotes,
    AlreadyClaimedOrSlashed,
    DidntVote,
    Voted,
    NothingToSlash,
    RuleNotAllowed,
    OwnableError(OwnableError),
    WrongParameters,
}

impl From<MathError> for GovernError {
    fn from(error: MathError) -> Self {
        GovernError::MathError(error)
    }
}

impl From<PSP22Error> for GovernError {
    fn from(error: PSP22Error) -> Self {
        GovernError::PSP22Error(error)
    }
}

impl From<StakeError> for GovernError {
    fn from(error: StakeError) -> Self {
        GovernError::StakeError(error)
    }
}

impl From<OwnableError> for GovernError {
    fn from(error: OwnableError) -> Self {
        GovernError::OwnableError(error)
    }
}

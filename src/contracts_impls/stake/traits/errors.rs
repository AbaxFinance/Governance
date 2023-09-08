use ink::LangError;
use openbrush::contracts::{
    ownable::OwnableError,
    psp22::PSP22Error,
};
use scale::{
    Decode,
    Encode,
};

#[derive(Encode, Decode, Debug)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum StakeError {
    PSP22Error(PSP22Error),
    LangError(LangError),
    MathError(MathError),
    AmountIsZero,
    AmountGreaterThanStake,
    InsufficientStake,
    UnstakeNotInitialized,
    NoInitializedUnstakes,
    TooEarly,
    Unstaking,
    NothingToUnstake,
    ToManyUnstakes,
    StakeIsZero,
    OwnableError(OwnableError),
}

impl From<LangError> for StakeError {
    fn from(error: LangError) -> Self {
        StakeError::LangError(error)
    }
}
impl From<PSP22Error> for StakeError {
    fn from(error: PSP22Error) -> Self {
        StakeError::PSP22Error(error)
    }
}

impl From<MathError> for StakeError {
    fn from(error: MathError) -> Self {
        StakeError::MathError(error)
    }
}

impl From<OwnableError> for StakeError {
    fn from(error: OwnableError) -> Self {
        StakeError::OwnableError(error)
    }
}

#[derive(Encode, Decode, Debug)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum MathError {
    Sub,
    Add,
    Div,
    Mul,
}

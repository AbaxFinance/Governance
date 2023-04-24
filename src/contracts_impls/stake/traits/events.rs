use openbrush::traits::{AccountId, Balance, Timestamp};

pub trait EmitStakeEvents {
    fn _emit_staked_event(&self, caller: &AccountId, amount: &Balance);
    fn _emit_initialized_unstake_event(&self, caller: &AccountId, amount: &Balance);
    fn _emit_unstake_event(&self, caller: &AccountId);
    fn _emit_rewarded_event(&self, account: &AccountId, amount: &Balance);
    fn _emit_slashed_event(&self, account: &AccountId, amount: &Balance);
    fn _emit_unstake_period_changed_event(&self, unstake_period: &Timestamp);

    fn _emit_maximal_number_of_unstakes_changed_event(&self, maximal_number_of_unstakes: &u64);
}

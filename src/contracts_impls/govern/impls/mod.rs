pub mod storage;

use crate::contracts_impls::{
    govern::traits::*,
    stake::{
        impls::{
            storage::data::{
                StakeCounterStorage,
                StakeStorage,
                StakeTimesStorage,
            },
            E12,
        },
        traits::{
            EmitStakeEvents,
            MathError,
            StakeInternal,
        },
    },
    timestamp_mock::impls::{
        TimestampMockInternal,
        TimestampMockStorage,
    },
};

use ink::{
    env::{
        call::{
            build_call,
            Call,
            ExecutionInput,
        },
        hash::Blake2x256,
        CallFlags,
        DefaultEnvironment,
    },
    prelude::vec::*,
};

use openbrush::{
    contracts::ownable::only_owner,
    modifiers,
    traits::{
        AccountId,
        Balance,
        Hash,
        Storage,
        String,
        Timestamp,
    },
};

pub use self::storage::{
    GovernRewardableSlashableStorage,
    GovernStorage,
};

pub struct CallInput<'a>(&'a [u8]);
impl<'a> scale::Encode for CallInput<'a> {
    fn encode_to<T: scale::Output + ?Sized>(&self, dest: &mut T) {
        dest.write(self.0);
    }
}
pub const E6: u128 = 10 ^ 6;

impl<T: Storage<GovernStorage> + GovernInternal + Storage<TimestampMockStorage>> GovernView for T {
    fn hash_proposal(&self, proposal: Proposal, description_hash: [u8; 32]) -> Hash {
        self._hash_proposal(&proposal, &description_hash)
    }

    fn rules(&self, rules_id: RulesId) -> Option<ProposalRules> {
        self.data::<GovernStorage>().rule(&rules_id)
    }

    fn rules_allowed(&self, rules_id: RulesId) -> bool {
        self.data::<GovernStorage>().rule_allowed(&rules_id)
    }

    fn next_rule_id(&self) -> RulesId {
        self.data::<GovernStorage>().next_rule_id()
    }

    fn status(&self, proposal_id: ProposalId) -> Option<ProposalStatus> {
        self.data::<GovernStorage>().status_of(&proposal_id)
    }
    fn minimum_to_finalize(&self, proposal_id: ProposalId) -> Result<Balance, GovernError> {
        let proposal = self
            .data::<GovernStorage>()
            .state_of(&proposal_id)
            .ok_or(GovernError::ProposalDoesntExist)?;
        let rules = self
            .data::<GovernStorage>()
            .rule(&proposal.rules_id)
            .ok_or(GovernError::NoSuchRule)?;
        let timestamp = self._timestamp();
        Ok(self._minimum_to_finalize(&proposal, &rules, timestamp))
    }

    fn state(&self, proposal_id: ProposalId) -> Option<ProposalState> {
        self.data::<GovernStorage>().state_of(&proposal_id)
    }

    fn vote_of_for(&self, account: AccountId, proposal_id: ProposalId) -> Option<UserVote> {
        self.data::<GovernStorage>().vote_of_for(&account, &proposal_id)
    }
}

impl<
        T: Storage<GovernStorage>
            + GovernInternal
            + Storage<StakeStorage>
            + StakeInternal
            + Storage<StakeTimesStorage>
            + Storage<StakeCounterStorage>
            + Storage<TimestampMockStorage>
            + TimestampMockInternal
            + EmitStakeEvents
            + EmitGovernEvents,
    > Govern for T
{
    /// # Storage modifications
    /// [GovernStorage]
    /// `state` - of key hash(`proposal`, hash(`description`)) is set to inital state
    fn propose(&mut self, proposal: Proposal, description: String) -> Result<Hash, GovernError> {
        self._check_rules(&proposal)?;
        let description_hash = Self::env().hash_bytes::<Blake2x256>(&description.as_bytes());
        let proposal_id = self._hash_proposal(&proposal, &description_hash);

        self._register_proposal(&proposal_id, &proposal, &description)?;

        Ok(proposal_id)
    }

    /// # Storage modifications
    /// [GovernStorage]
    /// `state` - of key `proposal_id` is modified by changing the status field to `Succeeded`, `Defeated`,`DefeatedWithSlash` based on votes.
    /// [StakeStorage]
    /// `stakes` of ket `state.proposer` is decreased if propsal resolved with `DefeatedWithSlash`.
    fn finalize(&mut self, proposal_id: ProposalId) -> Result<(), GovernError> {
        self._finalize(&proposal_id)?;
        Ok(())
    }

    fn execute(&mut self, proposal: Proposal, description_hash: [u8; 32]) -> Result<(), GovernError> {
        let proposal_id = self._hash_proposal(&proposal, &description_hash);
        self._execute(&proposal_id, &proposal)?;
        Ok(())
    }

    /// # Storage modification
    /// [GovernStorage]
    /// `votes` of key (`proposal_id`, `caller`) is set based on `stake` of key `caller` and parameter `vote`.
    /// `state` of key `proposal_id` votes fields are updated.
    fn vote(
        &mut self,
        proposal_id: ProposalId,
        vote: Vote,
        #[allow(unused_variables)] reason: Vec<u8>,
    ) -> Result<(), GovernError> {
        ink::env::debug_println!("vote | START");
        let caller = Self::env().caller();
        let state = self
            .data::<GovernStorage>()
            .state_of(&proposal_id)
            .ok_or(GovernError::ProposalDoesntExist)?;
        ink::env::debug_println!("vote | pull data");

        let amount = self
            .data::<StakeStorage>()
            .stake_and_unstakes_initialized_after(&caller, &state.start);
        self.data::<GovernStorage>()
            .update_vote_of_for(&caller, &proposal_id, &vote, &amount)?;
        self._emit_vote_casted_event(&caller, &proposal_id, &vote);
        ink::env::debug_println!("vote | STOP");

        Ok(())
    }
}

impl<
        T: Storage<GovernStorage>
            + GovernInternal
            + Storage<GovernRewardableSlashableStorage>
            + GovernRewardableSlashableInternal
            + Storage<StakeStorage>
            + StakeInternal
            + Storage<StakeTimesStorage>
            + Storage<StakeCounterStorage>
            + Storage<TimestampMockStorage>
            + TimestampMockInternal
            + EmitStakeEvents
            + EmitGovernEvents,
    > GovernRewardableSlashable for T
{
    fn claimed_or_slashed(&self, account: AccountId, proposal_id: ProposalId) -> bool {
        self._claimed_or_slashed(&account, &proposal_id)
    }

    /// # Storage modifications
    /// [GovernRewardableSlashableStorage]
    /// `claimed_or_slashed` of key `caller` set to ().
    /// [StakeStorage]
    /// `stake` of key `caller` increased by `amount`.
    /// `total_stake` increased by `amount`.
    /// [StakeCounterStorage]
    /// `counter_stake` increased by `amount`.
    /// [StakeTimesStorage]
    /// `stakes_timestamps` of key `caller set to `block_timestamp` if None.
    /// `last_stakes_timestamps` of key `caller` set to `block_timestamp`
    fn claim_reward(&mut self, proposal_id: ProposalId) -> Result<(), GovernError> {
        let caller = Self::env().caller();
        self._reward_voter(&caller, &proposal_id)?;
        Ok(())
    }

    /// # Storage modifications
    /// [GovernRewardableSlashableStorage]
    /// `claimed_or_slashed` of key `caller` set to ().
    /// [StakeStorage]
    /// `stakes` of key `caller` decreased by max(`amount`,`stakes` of key `caller`). Ig becomes 0 then remove.
    /// `total_stake` decreased by max max(`amount`,`stakes` of key `caller`).
    /// `unstakes` of keys `(caller, unstakes_id.0..unstakes_id.1)` field amount decreased appropriately to cover rest of max(`amount` - `stakes`, 0) of slash.
    /// `total_unstake` decreased by appropriately
    /// [StakeTimesStorage]
    /// `stakes_timestamps` of key `caller` removed if `stakes` of key `caller` was removed.
    /// `last_stakes_timestamps` oof key `caller` removed if `stakes` of key `caller` was removed.
    fn slash_voter(&mut self, account: AccountId, proposal_id: ProposalId) -> Result<(), GovernError> {
        self._slash_voter(&account, &proposal_id)?;
        Ok(())
    }
}

impl<T: Storage<GovernStorage> + Storage<openbrush::contracts::ownable::Data> + GovernInternal + EmitGovernEvents>
    GovernManage for T
{
    /// # Storage modifications
    /// [GovernStorage]
    /// `rules` of key `next_rule_id` set to `rules`
    /// `next_rule_id` increased by 1.
    #[modifiers(only_owner())]
    fn add_proposal_rules(&mut self, rules: ProposalRules) -> Result<(), GovernError> {
        let at_rule_id = self.data::<GovernStorage>().add_new_rule(&rules)?;
        self._emit_proposal_rule_added_event(&at_rule_id, &rules);
        Ok(())
    }
    /// # Storage modifications
    /// [GovernStorage]
    /// `rules_allowed` of key `rule_id` set to () if `allow` is true or else removed.
    #[modifiers(only_owner())]
    fn allow_rules(&mut self, rules_id: RulesId, allow: bool) -> Result<(), GovernError> {
        self.data::<GovernStorage>().allow_rules(&rules_id, &allow)?;
        self._emit_rules_allowed_event(&rules_id, &allow);
        Ok(())
    }
}

impl<
        T: Storage<GovernStorage>
            + Storage<StakeStorage>
            + StakeInternal
            + Storage<StakeTimesStorage>
            + Storage<StakeCounterStorage>
            + Storage<TimestampMockStorage>
            + TimestampMockInternal
            + EmitStakeEvents
            + EmitGovernEvents,
    > GovernInternal for T
{
    fn _hash_proposal(&self, proposal: &Proposal, description_hash: &[u8; 32]) -> ProposalId {
        let mut hash_data: Vec<u8> = Vec::new();

        hash_data.append(&mut scale::Encode::encode(&proposal));
        hash_data.append(&mut scale::Encode::encode(&description_hash));

        Hash::try_from(Self::env().hash_bytes::<Blake2x256>(&hash_data).as_ref()).unwrap()
    }
    fn _check_rules(&self, proposal: &Proposal) -> Result<(), GovernError> {
        if !self.data::<GovernStorage>().rule_allowed(&proposal.rules_id) {
            return Err(GovernError::RuleNotAllowed)
        }
        let rules = self
            .data::<GovernStorage>()
            .rule(&proposal.rules_id)
            .ok_or(GovernError::NoSuchRule)?;

        if Self::env().transferred_value() < rules.deposit {
            return Err(GovernError::PropositionDeposit)
        }

        let proposer_part_e12 = u64::try_from(
            self.data::<StakeStorage>()
                .stake_of(&Self::env().caller())
                .checked_mul(E12)
                .ok_or(MathError::Mul)?
                / self.data::<StakeStorage>().total_stake,
        )
        .unwrap_or(0);

        if proposer_part_e12 < rules.minimum_stake_part_e12 {
            return Err(GovernError::InnsuficientVotes)
        }

        if proposal.voter_reward_part_e12 > rules.maximal_voter_reward_part_e12
            || proposal.voter_reward_part_e12 > proposer_part_e12 / 2
        {
            return Err(GovernError::RewardMultiplier)
        }
        Ok(())
    }

    /// # Storage modifications
    /// [GovernStorage]
    /// `state` of key `proposal_id` set based on `proposal`
    fn _register_proposal(
        &mut self,
        proposal_id: &ProposalId,
        proposal: &Proposal,
        description: &String,
    ) -> Result<(), GovernError> {
        if self.data::<GovernStorage>().status_of(&proposal_id).is_some() {
            return Err(GovernError::ProposalAlreadyExists)
        }

        let timestamp = self._timestamp();
        let counter_at_start = self.data::<StakeCounterStorage>().counter_stake;
        let votes_at_start = self.data::<StakeStorage>().total_stake;
        let caller = Self::env().caller();
        self.data::<GovernStorage>().state.insert(
            &proposal_id,
            &ProposalState {
                status: ProposalStatus::Active,
                proposer: caller,
                voter_reward_part_e12: proposal.voter_reward_part_e12,
                rules_id: proposal.rules_id,
                start: timestamp,
                counter_at_start,
                votes_at_start,
                finalized: None,
                votes_for: 0,
                votes_against: 0,
                votes_against_with_slash: 0,
            },
        );

        self.data::<GovernStorage>().active_proposals += 1;

        self._emit_proposal_created_event(&proposal_id, proposal, description);
        Ok(())
    }

    fn _get_votes_at(&self, account: &AccountId, timestamp: &Timestamp) -> Balance {
        self.data::<StakeStorage>()
            .stake_and_unstakes_initialized_after(account, timestamp)
    }

    fn _minimum_to_finalize(&self, state: &ProposalState, rules: &ProposalRules, now: Timestamp) -> Balance {
        let end_initial_period = state.start + rules.initial_period;
        let end_flat_period = end_initial_period + rules.flat_period;
        let end_final_period = end_flat_period + rules.final_period;

        let counter_diff = self.data::<StakeCounterStorage>().counter_stake - state.counter_at_start;
        let total_votes = counter_diff + state.votes_at_start;

        if now <= end_initial_period {
            ink::env::debug_println!("initial");
            total_votes / 2 * (end_initial_period - now) as u128 / rules.initial_period as u128 + total_votes / 2
        } else if now <= end_flat_period {
            ink::env::debug_println!("mid");
            total_votes / 2
        } else if now <= end_final_period {
            ink::env::debug_println!("final");
            total_votes / 2 * (end_final_period - now) as u128 / rules.final_period as u128
        } else {
            ink::env::debug_println!("last");
            0
        }
    }

    /// # Storage modifications
    /// [GovernStorage]
    /// `state` of key `proposal_id` field status set to apropariate status, field finalized set to `block_timestamp`.
    fn _finalize(&mut self, proposal_id: &ProposalId) -> Result<(), GovernError> {
        let mut state = self
            .data::<GovernStorage>()
            .state_of(&proposal_id)
            .ok_or(GovernError::ProposalDoesntExist)?;

        if state.status != ProposalStatus::Active {
            return Err(GovernError::NotActive)
        }

        let rules = self
            .data::<GovernStorage>()
            .rule(&state.rules_id)
            .ok_or(GovernError::NoSuchRule)?;

        let minimum_to_finalize = self._minimum_to_finalize(&state, &rules, self._timestamp());

        if state.votes_against + state.votes_against_with_slash >= minimum_to_finalize {
            if state.votes_against_with_slash <= state.votes_against + state.votes_for {
                state.status = ProposalStatus::Defeated;
                match ink::env::transfer::<DefaultEnvironment>(state.proposer, rules.deposit) {
                    Ok(()) => (),
                    Err(_v) => return Err(GovernError::TransferError),
                };
            } else {
                state.status = ProposalStatus::DefeatedWithSlash;
                let slash_part_e12 = rules.proposer_slash_part_e12 as u128;
                let slash_amount = self
                    .data::<StakeStorage>()
                    .stake_and_unstakes_initialized_after(&state.proposer, &state.start)
                    .checked_mul(slash_part_e12)
                    .ok_or(MathError::Mul)?
                    / E12;
                self._slash(&state.proposer, &slash_amount)?;
            }
        } else if state.votes_for >= minimum_to_finalize {
            state.status = ProposalStatus::Succeeded;
            match ink::env::transfer::<DefaultEnvironment>(state.proposer, rules.deposit) {
                Ok(()) => (),
                Err(_v) => return Err(GovernError::TransferError),
            };
        } else {
            return Err(GovernError::FinalizeCondition)
        }
        state.finalized = Some(self._timestamp());

        self.data::<GovernStorage>().state.insert(&proposal_id, &state);
        self.data::<GovernStorage>().active_proposals -= 1;
        self.data::<GovernStorage>().finalized_proposals += 1;

        self._emit_proposal_finalized_event(&proposal_id, &state.status);
        Ok(())
    }

    /// # Storage modifications
    /// [GovernStorage]
    /// `state` of key `proposal_id` status set to Executed
    fn _execute(&mut self, proposal_id: &ProposalId, proposal: &Proposal) -> Result<(), GovernError> {
        let mut state = self
            .data::<GovernStorage>()
            .state_of(&proposal_id)
            .ok_or(GovernError::ProposalDoesntExist)?;
        if state.status != ProposalStatus::Succeeded {
            return Err(GovernError::WrongStatus)
        }

        for tx in &proposal.transactions {
            self.flush();
            let result = build_call::<DefaultEnvironment>()
                .call_type(
                    Call::new(tx.callee)
                        .gas_limit(0)
                        .transferred_value(tx.transferred_value),
                )
                .exec_input(ExecutionInput::new(tx.selector.into()).push_arg(CallInput(&tx.input)))
                .returns::<()>()
                .call_flags(CallFlags::default().set_allow_reentry(true))
                .try_invoke()
                .map_err(|_| GovernError::UnderlyingTransactionReverted);
            self.load();
            result?.unwrap()
        }

        state.status = ProposalStatus::Executed;

        self.data::<GovernStorage>().state.insert(&proposal_id, &state);

        self._emit_proposal_executed_event(&proposal_id);
        Ok(())
    }
}

impl<
        T: Storage<GovernStorage>
            + Storage<GovernRewardableSlashableStorage>
            + Storage<StakeStorage>
            + StakeInternal
            + Storage<StakeTimesStorage>
            + Storage<StakeCounterStorage>
            + Storage<TimestampMockStorage>
            + TimestampMockInternal
            + EmitStakeEvents
            + EmitGovernEvents,
    > GovernRewardableSlashableInternal for T
{
    fn _claimed_or_slashed(&self, account: &AccountId, proposal_id: &ProposalId) -> bool {
        if self
            .data::<GovernRewardableSlashableStorage>()
            .claimed_or_slashed
            .get(&(*account, *proposal_id))
            .is_some()
        {
            return true
        } else {
            return false
        }
    }

    /// # Storage modifications
    /// [GovernRewardableSlashableStorage]
    /// `claimed_or_slashed` of key `account` set to ().
    /// [StakeStorage]
    /// `stake` of key `account` increased by `amount`.
    /// `total_stake` increased by `amount`.
    /// [StakeCounterStorage]
    /// `counter_stake` increased by `amount`.
    /// [StakeTimesStorage]
    /// `stakes_timestamps` of key `account set to `block_timestamp` if None.
    /// `last_stakes_timestamps` of key account set to `block_timestamp`
    fn _reward_voter(&mut self, account: &AccountId, proposal_id: &ProposalId) -> Result<(), GovernError> {
        let state = self
            .data::<GovernStorage>()
            .state_of(proposal_id)
            .ok_or(GovernError::ProposalDoesntExist)?;
        if state.status == ProposalStatus::Active {
            return Err(GovernError::StillActive)
        }
        if self._claimed_or_slashed(account, proposal_id) {
            return Err(GovernError::AlreadyClaimedOrSlashed)
        }
        let vote = self
            .data::<GovernStorage>()
            .vote_of_for(account, proposal_id)
            .ok_or(GovernError::DidntVote)?;

        let reward = vote
            .amount
            .checked_mul(state.voter_reward_part_e12 as u128)
            .ok_or(MathError::Mul)?
            / E12;
        self._reward(account, &reward)?;
        self.data::<GovernRewardableSlashableStorage>()
            .claimed_or_slashed
            .insert(&(*account, *proposal_id), &());

        self._emit_voter_rewarded_event(account, proposal_id);
        Ok(())
    }

    /// # Storage modifications
    /// [GovernRewardableSlashableStorage]
    /// `claimed_or_slashed` of key `account` set to ().
    /// [StakeStorage]
    /// `stakes` of key `account` decreased by max(`amount`,`stakes` of key `account`). Ig becomes 0 then remove.
    /// `total_stake` decreased by max max(`amount`,`stakes` of key `account`).
    /// `unstakes` of keys `(account, unstakes_id.0..unstakes_id.1)` field amount decreased appropriately to cover rest of max(`amount` - `stakes`, 0) of slash.
    /// `total_unstake` decreased by appropriately
    /// [StakeTimesStorage]
    /// `stakes_timestamps` of key `account` removed if `stakes` of key `account` was removed.
    /// `last_stakes_timestamps` oof key `account` removed if `stakes` of key `account` was removed.
    fn _slash_voter(&mut self, account: &AccountId, proposal_id: &ProposalId) -> Result<(), GovernError> {
        let state = self
            .data::<GovernStorage>()
            .state_of(proposal_id)
            .ok_or(GovernError::ProposalDoesntExist)?;
        if state.status == ProposalStatus::Active {
            return Err(GovernError::StillActive)
        }
        let rules = self
            .data::<GovernStorage>()
            .rule(&state.rules_id)
            .ok_or(GovernError::NoSuchRule)?;
        if state.finalized.unwrap() <= state.start + rules.initial_period + rules.flat_period {
            return Err(GovernError::NothingToSlash)
        }
        if self.data::<StakeTimesStorage>().stake_timestamp_of(&account).is_some() {
            if self.data::<StakeTimesStorage>().stake_timestamp_of(account).unwrap()
                > state.finalized.unwrap() - 24 * 60 * 60 * 1000
            {
                return Err(GovernError::NothingToSlash)
            }
        }

        if self._claimed_or_slashed(account, proposal_id) {
            return Err(GovernError::AlreadyClaimedOrSlashed)
        };
        if self.data::<GovernStorage>().vote_of_for(account, proposal_id).is_some() {
            return Err(GovernError::Voted)
        };

        let stake_at_start = self
            .data::<StakeStorage>()
            .stake_and_unstakes_initialized_after(account, &state.start);

        let penalty = stake_at_start
            .checked_mul(rules.voter_slash_part_e12 as u128)
            .ok_or(MathError::Mul)?
            / E12;

        self._slash(account, &penalty)?;

        self.data::<GovernRewardableSlashableStorage>()
            .claimed_or_slashed
            .insert(&(*account, *proposal_id), &());
        self._emit_voter_slashed_event(account, proposal_id);
        Ok(())
    }
}

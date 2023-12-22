import { KeyringPair } from '@polkadot/keyring/types';
import { AccountId, Balance, E12, ProposalId, Timestamp } from 'scripts/types_and_consts';
import Governor from 'typechain/contracts/governor';
import BlockTimestampProvider from 'typechain/contracts/block_timestamp_provider';
import { StakeError, Unstake } from 'typechain/types-returns/staker';
import { expect } from 'tests/setup/chai';
import { TestEnv } from '../../make-suite';
import { replaceRNPropsWithStrings } from '../../misc';
import { ReturnNumber } from '@727-ventures/typechain-types';
import { GovernError, ProposalState, ProposalStatus, UserVote, Vote } from 'typechain/types-returns/governor';
import { Hash, Proposal } from 'typechain/types-arguments/governor';
import BN from 'bn.js';
import { ContractPromise } from '@polkadot/api-contract';
import { apiProviderWrapper } from 'tests/setup/helpers';
import { numbersToHex } from 'tests/utlis/converters/hex-number';

export interface FinalizeStorageModifications {
  //[GovernorStorage]
  state: ProposalState;
  //[StakeSotrage]
  proposer_stake: Balance;
  totalStake: Balance;
  totalUnstake: Balance;
  unstakes: Unstake[];
  //[StakeTimesStorage]
  stakesTimestampOf: Timestamp | null;
  lastStakeTimestampOf: Timestamp | null;
}

export async function getFinalizeStorageModifications(governor: Governor, proposal_id: Hash): Promise<FinalizeStorageModifications> {
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  const state = (await governor.query.state(proposal_id)).value.ok!;
  return {
    //[GovernorStorage]
    state: state,
    //[StakeSotrage]
    proposer_stake: (await governor.query.stakeOf(state.proposer)).value.ok!.rawNumber,
    totalStake: (await governor.query.totalStake()).value.ok!.rawNumber,
    totalUnstake: (await governor.query.totalUnstake()).value.ok!.rawNumber,
    unstakes: (await governor.query.initializedUnstakesOf(state.proposer)).value.ok!,
    //[StakeTimesStorage]
    stakesTimestampOf: (await governor.query.stakeTimestampOf(state.proposer)).value.ok!,
    lastStakeTimestampOf: (await governor.query.lastStakeTimestampOf(state.proposer)).value.ok!,
  };
  /* eslint-enable @typescript-eslint/no-non-null-assertion */
}

export async function finalizeAndCheck(
  testEnv: TestEnv,
  caller: KeyringPair,
  proposalId: Hash,
  result?: ProposalStatus | undefined,
  error?: GovernError | undefined,
) {
  const governor: Governor = testEnv.governor;
  const queryRes = (await governor.withSigner(caller).query.finalize(proposalId)).value.ok;
  if (error !== undefined) {
    expect(queryRes).to.have.deep.property('err', error);
    return;
  }

  const timestampProvider: BlockTimestampProvider = testEnv.timestampProvider;

  const storageStateBefore: FinalizeStorageModifications = await getFinalizeStorageModifications(governor, proposalId);
  const timestamp = (await timestampProvider.query.getBlockTimestamp()).value.ok!; // eslint-disable-line @typescript-eslint/no-non-null-assertion

  // const api = await apiProviderWrapper.getAndWaitForReady();
  // const governor2 = new ContractPromise(api, governor.abi, governor.address);

  //// need to take it befoer tx as slashing changes the result!!!!
  const stakeAndUnstakesInitializedAfter = (
    await governor.query.stakeAndUnstakesInitializedAfter(storageStateBefore.state.proposer, storageStateBefore.state.start)
  ).value.ok!.rawNumber;
  ////

  const tx = governor.withSigner(caller).tx.finalize(proposalId);
  await expect(tx).to.eventually.be.fulfilled;
  const txRes = await tx;

  const storageStateAfter: FinalizeStorageModifications = await getFinalizeStorageModifications(governor, proposalId);
  const rules = (await governor.query.rules(storageStateBefore.state.rulesId)).value.ok!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  const amount = stakeAndUnstakesInitializedAfter.mul(new BN(rules.proposerSlashPartE12.toString())).div(E12); // eslint-disable-line @typescript-eslint/no-non-null-assertion
  const enoughStake = storageStateBefore.proposer_stake.gte(amount);
  const stakeRemoved = storageStateBefore.proposer_stake.lte(amount);
  const remainingAmountToBeSlashed = enoughStake ? new BN(0) : amount.sub(storageStateBefore.proposer_stake);
  const remainingAmountToBeSlashedFromUnstakes = new BN(remainingAmountToBeSlashed.toString());
  const expectedUnstakes: Unstake[] = storageStateBefore.unstakes
    .slice()
    .reverse()
    .reduce((acc: Unstake[], unstake: Unstake) => {
      if (remainingAmountToBeSlashedFromUnstakes.gt(new BN(0))) {
        const amountToRemoveFromThisUnstake = new BN(BN.min(unstake.amount.rawNumber, remainingAmountToBeSlashedFromUnstakes).toString());
        remainingAmountToBeSlashedFromUnstakes.isub(amountToRemoveFromThisUnstake);
        if (amountToRemoveFromThisUnstake.lt(unstake.amount.rawNumber)) {
          acc.push({ initTime: unstake.initTime, amount: new ReturnNumber(unstake.amount.rawNumber.sub(amountToRemoveFromThisUnstake)) });
        }
        return acc;
      } else {
        acc.push(unstake);
        return acc;
      }
    }, [])
    .reverse();

  const storageStateExpected: FinalizeStorageModifications = {
    //[GovernorStorage]
    state: {
      status: result!,
      proposer: storageStateBefore.state.proposer,
      voterRewardPartE12: storageStateBefore.state.voterRewardPartE12,
      rulesId: storageStateBefore.state.rulesId,
      start: storageStateBefore.state.start,
      votesAtStart: storageStateBefore.state.votesAtStart,
      counterAtStart: storageStateBefore.state.counterAtStart,
      finalized: timestamp,
      votesFor: storageStateBefore.state.votesFor,
      votesAgainst: storageStateBefore.state.votesAgainst,
      votesAgainstWithSlash: storageStateBefore.state.votesAgainstWithSlash,
    },
    //[StakeStorage]
    proposer_stake:
      result !== ProposalStatus.defeatedWithSlash
        ? storageStateBefore.proposer_stake
        : enoughStake
        ? storageStateBefore.proposer_stake.sub(amount)
        : new BN(0),
    totalStake:
      result !== ProposalStatus.defeatedWithSlash
        ? storageStateBefore.totalStake
        : storageStateBefore.proposer_stake.gte(amount)
        ? storageStateBefore.totalStake.sub(amount)
        : storageStateBefore.totalStake.sub(storageStateBefore.proposer_stake),
    totalUnstake:
      result !== ProposalStatus.defeatedWithSlash
        ? storageStateBefore.totalUnstake
        : storageStateBefore.totalUnstake.add(remainingAmountToBeSlashedFromUnstakes).sub(remainingAmountToBeSlashed),
    unstakes: result !== ProposalStatus.defeatedWithSlash ? storageStateBefore.unstakes : expectedUnstakes,
    //[StakeTimesStorage]
    stakesTimestampOf: result === ProposalStatus.defeatedWithSlash && stakeRemoved ? null : storageStateBefore.stakesTimestampOf,
    lastStakeTimestampOf: result === ProposalStatus.defeatedWithSlash && stakeRemoved ? null : storageStateBefore.lastStakeTimestampOf,
  };

  expect.soft(replaceRNPropsWithStrings(storageStateAfter)).to.deep.equal(replaceRNPropsWithStrings(storageStateExpected));

  if (result !== ProposalStatus.defeatedWithSlash) {
    expect.soft(replaceRNPropsWithStrings(txRes.events)).to.deep.equal([
      {
        name: 'ProposalFinalized',
        args: {
          proposalId: '0x' + numbersToHex(proposalId as number[]),
          status: result!,
        },
      },
    ]);
  } else {
    expect.soft(replaceRNPropsWithStrings(txRes.events)).to.deep.equal([
      {
        name: 'Slashed',
        args: {
          account: storageStateBefore.state.proposer,
          amount: amount.toString(),
        },
      },
      {
        name: 'ProposalFinalized',
        args: {
          proposalId: '0x' + numbersToHex(proposalId as number[]),
          status: result!,
        },
      },
    ]);
  }
  expect.flushSoft();
}

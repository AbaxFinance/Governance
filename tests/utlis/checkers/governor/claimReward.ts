import { KeyringPair } from '@polkadot/keyring/types';
import { Balance, E12 } from 'scripts/types_and_consts';
import Governor from 'typechain/contracts/governor';
import { StakeError } from 'typechain/types-returns/staker';
import { expect } from 'tests/setup/chai';
import { TestEnv } from '../../make-suite';
import { replaceRNPropsWithStrings } from '../../misc';
import BN from 'bn.js';
import { numbersToHex } from 'tests/utlis/converters/hex-number';

export interface ClaimRewardStorageModifications {
  //[GovernorRewardableSlashableStorage]
  claimedOrSlashed: boolean;
  //[StakeStorage]
  stakeOf: Balance;
  totalStake: Balance;
  //[StakeCounterStorage]
  counter: Balance;
}

export async function getClaimRewardStorageModifications(
  governor: Governor,
  caller: KeyringPair,
  proposalId: number[],
): Promise<ClaimRewardStorageModifications> {
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  return {
    //[GovernorRewardableSlashableStorage]
    claimedOrSlashed: (await governor.query.claimedOrSlashed(caller.address, proposalId)).value.ok!,
    //[StakeStorage]
    stakeOf: (await governor.query.stakeOf(caller.address)).value.ok!.rawNumber,
    totalStake: (await governor.query.totalStake()).value.ok!.rawNumber,
    //[StakeCounterStorage]
    counter: (await governor.query.counterStake()).value.ok!.rawNumber,
  };
  /* eslint-enable @typescript-eslint/no-non-null-assertion */
}

export async function claimRewardAndCheck(testEnv: TestEnv, caller: KeyringPair, proposalId: number[], error?: StakeError | undefined) {
  const governor: Governor = testEnv.governor;

  const storageStateBefore: ClaimRewardStorageModifications = await getClaimRewardStorageModifications(governor, caller, proposalId);

  const queryRes = (await governor.withSigner(caller).query.claimReward(proposalId)).value.ok;
  if (error !== undefined) {
    expect(queryRes).to.have.deep.property('err', error);
    return;
  }

  //// need to take it befoer tx as slashing changes the result!!!!
  const state = (await governor.query.state(proposalId)).value.ok!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  const votesAmount = (await governor.query.voteOfFor(caller.address, proposalId)).value.ok!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  const amount = votesAmount.amount.rawNumber.mul(new BN(state.voterRewardPartE12.toString())).div(E12); // eslint-disable-line @typescript-eslint/no-non-null-assertion
  ////

  const tx = governor.withSigner(caller).tx.claimReward(proposalId);
  await expect(tx).to.eventually.be.fulfilled;
  const txRes = await tx;

  const storageStateAfter: ClaimRewardStorageModifications = await getClaimRewardStorageModifications(governor, caller, proposalId);

  const storageStateExpected: ClaimRewardStorageModifications = {
    //[GovernorRewardableSlashableStorage]
    claimedOrSlashed: true,
    //[StakeStorage]
    stakeOf: (storageStateBefore.stakeOf as BN).add(amount),
    totalStake: storageStateBefore.totalStake.add(amount),
    //[StakeCounterStorage]
    counter: storageStateBefore.counter.add(amount),
  };

  expect.soft(replaceRNPropsWithStrings(storageStateAfter)).to.deep.equal(replaceRNPropsWithStrings(storageStateExpected));

  expect.soft(replaceRNPropsWithStrings(txRes.events)).to.deep.equal([
    {
      name: 'Rewarded',
      args: {
        account: caller.address,
        amount: amount.toString(),
      },
    },
    {
      name: 'VoterRewarded',
      args: {
        account: caller.address,
        proposalId: '0x' + numbersToHex(proposalId as number[]),
      },
    },
  ]);
  expect.flushSoft();
}

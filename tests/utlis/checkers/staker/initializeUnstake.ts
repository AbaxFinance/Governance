import { KeyringPair } from '@polkadot/keyring/types';
import { Balance, Timestamp } from 'scripts/types_and_consts';
import Staker from 'typechain/contracts/staker';
import BlockTimestampProvider from 'typechain/contracts/block_timestamp_provider';
import { StakeError, Unstake } from 'typechain/types-returns/staker';
import { expect } from 'tests/setup/chai';
import { TestEnv } from '../../make-suite';
import { replaceRNPropsWithStrings } from '../../misc';
import { ReturnNumber } from '@727-ventures/typechain-types';

export interface InitializedUnstakeStorageModifications {
  //[StakeStorage]
  stakeOf: Balance;
  totalStake: Balance;
  totalUnstake: Balance;
  unstakes: Unstake[];
  //[StakeTimesStorage]
  stakesTimestampOf: Timestamp | null;
  lastStakeTimestampOf: Timestamp | null;
}

export async function getInitializedUnstakeStorageModifications(
  staker: Staker,
  caller: KeyringPair,
): Promise<InitializedUnstakeStorageModifications> {
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  return {
    //[StakeStorage]
    stakeOf: (await staker.query.stakeOf(caller.address)).value.ok!.rawNumber,
    totalStake: (await staker.query.totalStake()).value.ok!.rawNumber,
    totalUnstake: (await staker.query.totalUnstake()).value.ok!.rawNumber,
    unstakes: (await staker.query.initializedUnstakesOf(caller.address)).value.ok!,
    //[StakeTimesStorage]
    stakesTimestampOf: (await staker.query.stakeTimestampOf(caller.address)).value.ok!,
    lastStakeTimestampOf: (await staker.query.lastStakeTimestampOf(caller.address)).value.ok!,
  };
  /* eslint-enable @typescript-eslint/no-non-null-assertion */
}

export async function initializeUnstakeAndCheck(testEnv: TestEnv, caller: KeyringPair, amount: Balance, error?: StakeError | undefined) {
  const staker: Staker = testEnv.staker;
  const timestampProvider: BlockTimestampProvider = testEnv.timestampProvider;

  const storageStateBefore: InitializedUnstakeStorageModifications = await getInitializedUnstakeStorageModifications(testEnv.staker, caller);
  const timestamp = (await timestampProvider.query.getBlockTimestamp()).value.ok!; // eslint-disable-line @typescript-eslint/no-non-null-assertion

  const queryRes = (await staker.withSigner(caller).query.initializeUnstake(amount)).value.ok;
  if (error !== undefined) {
    expect(queryRes).to.have.deep.property('err', error);
    return;
  }

  const tx = staker.withSigner(caller).tx.initializeUnstake(amount);
  await expect(tx).to.eventually.be.fulfilled;
  const txRes = await tx;

  const storageStateAfter: InitializedUnstakeStorageModifications = await getInitializedUnstakeStorageModifications(testEnv.staker, caller);

  const storageStateExpected: InitializedUnstakeStorageModifications = {
    //[StakeStorage]
    stakeOf: storageStateBefore.stakeOf.sub(amount),
    totalStake: storageStateBefore.totalStake.sub(amount),
    totalUnstake: storageStateBefore.totalUnstake.add(amount),
    unstakes: [...storageStateBefore.unstakes, { initTime: timestamp, amount: new ReturnNumber(amount) }],
    //[StakeTimesStorage]
    stakesTimestampOf: storageStateBefore.stakeOf.sub(amount).toString() === '0' ? null : storageStateBefore.stakesTimestampOf,
    lastStakeTimestampOf: storageStateBefore.stakeOf.sub(amount).toString() === '0' ? null : storageStateBefore.lastStakeTimestampOf,
  };

  expect.soft(replaceRNPropsWithStrings(storageStateAfter)).to.deep.equal(replaceRNPropsWithStrings(storageStateExpected));

  expect.soft(replaceRNPropsWithStrings(txRes.events)).to.deep.equal([
    {
      name: 'InitializedUnstake',
      args: {
        caller: caller.address,
        amount: amount.toString(),
      },
    },
  ]);
  expect.flushSoft();
}

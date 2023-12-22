import { KeyringPair } from '@polkadot/keyring/types';
import { Balance, Timestamp } from 'scripts/types_and_consts';
import Staker from 'typechain/contracts/staker';
import BlockTimestampProvider from 'typechain/contracts/block_timestamp_provider';
import { StakeError } from 'typechain/types-returns/staker';
import { expect } from 'tests/setup/chai';
import { TestEnv } from '../../make-suite';
import { replaceRNPropsWithStrings } from '../../misc';
import BN from 'bn.js';

export interface StakeStorageModifications {
  //[StakeStorage]
  stakeOf: Balance;
  totalStake: Balance;
  //[StakeTimesStorage]
  stakesTimestampOf: Timestamp | null;
  lastStakeTimestampOf: Timestamp | null;
  //[StakeCounterStorage]
  counter: Balance;
}

export async function getStakeStorageModifications(staker: Staker, caller: KeyringPair): Promise<StakeStorageModifications> {
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  return {
    //[StakeStorage]
    stakeOf: (await staker.query.stakeOf(caller.address)).value.ok!.rawNumber,
    totalStake: (await staker.query.totalStake()).value.ok!.rawNumber,
    //[StakeTimesStorage]
    stakesTimestampOf: (await staker.query.stakeTimestampOf(caller.address)).value.ok!,
    lastStakeTimestampOf: (await staker.query.lastStakeTimestampOf(caller.address)).value.ok!,
    //[StakeCounterStorage]
    counter: (await staker.query.counterStake()).value.ok!.rawNumber,
  };
  /* eslint-enable @typescript-eslint/no-non-null-assertion */
}

export async function stakeAndCheck(testEnv: TestEnv, caller: KeyringPair, amount: Balance, error?: StakeError | undefined) {
  const staker: Staker = testEnv.staker;
  const timestampProvider: BlockTimestampProvider = testEnv.timestampProvider;

  const storageStateBefore: StakeStorageModifications = await getStakeStorageModifications(staker, caller);

  const timestamp = (await timestampProvider.query.getBlockTimestamp()).value.ok!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  console.log(timestamp);

  const queryRes = (await staker.withSigner(caller).query.stake(amount)).value.ok;
  if (error !== undefined) {
    expect(queryRes).to.have.deep.property('err', error);
    return;
  }

  const tx = staker.withSigner(caller).tx.stake(amount);
  await expect(tx).to.eventually.be.fulfilled;
  const txRes = await tx;

  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  const storageStateAfter: StakeStorageModifications = await getStakeStorageModifications(staker, caller);
  /* eslint-enable @typescript-eslint/no-non-null-assertion */

  const storageStateExpected: StakeStorageModifications = {
    stakeOf: (storageStateBefore.stakeOf as BN).add(amount),
    totalStake: storageStateBefore.totalStake.add(amount),
    stakesTimestampOf: storageStateBefore.stakesTimestampOf !== null ? storageStateBefore.stakesTimestampOf : timestamp,
    lastStakeTimestampOf: timestamp,
    counter: storageStateBefore.counter.add(amount),
  };

  expect.soft(replaceRNPropsWithStrings(storageStateAfter)).to.deep.equal(replaceRNPropsWithStrings(storageStateExpected));

  expect.soft(replaceRNPropsWithStrings(txRes.events)).to.deep.equal([
    {
      name: 'Staked',
      args: {
        caller: caller.address,
        amount: amount.toString(),
      },
    },
  ]);
  expect.flushSoft();
}

import { KeyringPair } from '@polkadot/keyring/types';
import { Balance } from 'scripts/types_and_consts';
import Staker from 'typechain/contracts/staker';
import BlockTimestampProvider from 'typechain/contracts/block_timestamp_provider';
import { StakeError, Unstake } from 'typechain/types-returns/staker';
import { expect } from 'tests/setup/chai';
import { TestEnv } from '../../make-suite';
import { replaceRNPropsWithStrings } from '../../misc';
import { BN } from 'bn.js';

export interface UnstakeStorageModifications {
  //[StakeStorage]
  totalUnstake: Balance;
  unstakes: Unstake[];
}

export async function getUnstakeStorageModifications(staker: Staker, caller: KeyringPair): Promise<UnstakeStorageModifications> {
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  return {
    //[StakeStorage]
    totalUnstake: (await staker.query.totalUnstake()).value.ok!.rawNumber,
    unstakes: (await staker.query.initializedUnstakesOf(caller.address)).value.ok!,
  };
  /* eslint-enable @typescript-eslint/no-non-null-assertion */
}

export async function unstakeAndCheck(testEnv: TestEnv, caller: KeyringPair, error?: StakeError | undefined) {
  const staker: Staker = testEnv.staker;
  const timestampProvider: BlockTimestampProvider = testEnv.timestampProvider;

  const storageStateBefore: UnstakeStorageModifications = await getUnstakeStorageModifications(testEnv.staker, caller);

  const timestamp = (await timestampProvider.query.getBlockTimestamp()).value.ok!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  const unstakePeriod = (await staker.query.unstakePeriod()).value.ok!; // eslint-disable-line @typescript-eslint/no-non-null-assertion

  const queryRes = (await staker.withSigner(caller).query.unstake()).value.ok;
  if (error !== undefined) {
    expect(queryRes).to.have.deep.property('err', error);
    return;
  }

  const tx = staker.withSigner(caller).tx.unstake();
  await expect(tx).to.eventually.be.fulfilled;
  const txRes = await tx;

  const storageStateAfter: UnstakeStorageModifications = await getUnstakeStorageModifications(testEnv.staker, caller);

  const expectedUnstakes = storageStateBefore.unstakes.filter((unstake) => timestamp < unstake.initTime + unstakePeriod);
  const unstakedAmount = storageStateBefore.unstakes.reduce((acc, unstake) => {
    if (timestamp < unstake.initTime + unstakePeriod) {
      return acc;
    } else {
      return acc.add(unstake.amount.rawNumber);
    }
  }, new BN(0));
  const storageStateExpected: UnstakeStorageModifications = {
    //[StakeStorage]
    totalUnstake: storageStateBefore.totalUnstake.sub(unstakedAmount),
    unstakes: expectedUnstakes,
  };

  expect.soft(replaceRNPropsWithStrings(storageStateAfter)).to.deep.equal(replaceRNPropsWithStrings(storageStateExpected));

  expect.soft(replaceRNPropsWithStrings(txRes.events)).to.deep.equal([
    {
      name: 'Unstaked',
      args: {
        caller: caller.address,
      },
    },
  ]);
  expect.flushSoft();
}

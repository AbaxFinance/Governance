import { KeyringPair } from '@polkadot/keyring/types';
import { Balance } from 'scripts/types_and_consts';
import Staker from 'typechain/contracts/staker';
import { StakeError } from 'typechain/types-returns/staker';
import { expect } from 'tests/setup/chai';
import { TestEnv } from '../../make-suite';
import { replaceRNPropsWithStrings } from '../../misc';
import BN from 'bn.js';

export interface RewardStorageModifications {
  //[StakeStorage]
  stakeOf: Balance;
  totalStake: Balance;
  //[StakeCounterStorage]
  counter: Balance;
}

export async function getRewardStorageModifications(staker: Staker, caller: KeyringPair): Promise<RewardStorageModifications> {
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  return {
    //[StakeStorage]
    stakeOf: (await staker.query.stakeOf(caller.address)).value.ok!.rawNumber,
    totalStake: (await staker.query.totalStake()).value.ok!.rawNumber,
    //[StakeCounterStorage]
    counter: (await staker.query.counterStake()).value.ok!.rawNumber,
  };
  /* eslint-enable @typescript-eslint/no-non-null-assertion */
}

export async function rewardAndCheck(testEnv: TestEnv, caller: KeyringPair, account: KeyringPair, amount: Balance, error?: StakeError | undefined) {
  const staker: Staker = testEnv.staker;

  const storageStateBefore: RewardStorageModifications = await getRewardStorageModifications(staker, account);

  const queryRes = (await staker.withSigner(caller).query.reward(account.address, amount)).value.ok;
  if (error !== undefined) {
    expect(queryRes).to.have.deep.property('err', error);
    return;
  }

  const tx = staker.withSigner(caller).tx.reward(account.address, amount);
  await expect(tx).to.eventually.be.fulfilled;
  const txRes = await tx;

  const storageStateAfter: RewardStorageModifications = await getRewardStorageModifications(staker, account);

  const storageStateExpected: RewardStorageModifications = {
    stakeOf: (storageStateBefore.stakeOf as BN).add(amount),
    totalStake: storageStateBefore.totalStake.add(amount),
    counter: storageStateBefore.counter.add(amount),
  };

  expect.soft(replaceRNPropsWithStrings(storageStateAfter)).to.deep.equal(replaceRNPropsWithStrings(storageStateExpected));

  expect.soft(replaceRNPropsWithStrings(txRes.events)).to.deep.equal([
    {
      name: 'Rewarded',
      args: {
        account: account.address,
        amount: amount.toString(),
      },
    },
  ]);
  expect.flushSoft();
}

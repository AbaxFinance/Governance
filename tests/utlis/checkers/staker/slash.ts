import { KeyringPair } from '@polkadot/keyring/types';
import { Balance, Timestamp } from 'scripts/types_and_consts';
import Staker from 'typechain/contracts/staker';
import { StakeError, Unstake } from 'typechain/types-returns/staker';
import { expect } from 'tests/setup/chai';
import { TestEnv } from '../../make-suite';
import { replaceRNPropsWithStrings } from '../../misc';
import { BN } from 'bn.js';
import { ReturnNumber } from '@727-ventures/typechain-types';

export interface SlashStorageModifications {
  //[StakeStorage]
  stakeOf: Balance;
  totalStake: Balance;
  totalUnstake: Balance;
  unstakes: Unstake[];
  //[StakeTimesStorage]
  stakesTimestampOf: Timestamp | null;
  lastStakeTimestampOf: Timestamp | null;
}

export async function getSlashStorageModifications(staker: Staker, caller: KeyringPair): Promise<SlashStorageModifications> {
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

export async function slashAndCheck(
  testEnv: TestEnv,
  caller: KeyringPair,
  account: KeyringPair,
  amount: Balance,
  result?: Balance,
  error?: StakeError | undefined,
) {
  const staker: Staker = testEnv.staker;

  const storageStateBefore: SlashStorageModifications = await getSlashStorageModifications(testEnv.staker, account);

  const queryRes = (await staker.withSigner(caller).query.slash(account.address, amount)).value.ok!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  if (error !== undefined) {
    expect(queryRes).to.have.deep.property('err', error);
    return;
  }
  if (result !== undefined) {
    expect.soft(queryRes.unwrap().rawNumber.toString(), 'result').to.be.equal(result.toString());
  }

  const tx = staker.withSigner(caller).tx.slash(account.address, amount);
  await expect(tx).to.eventually.be.fulfilled;
  const txRes = await tx;

  const storageStateAfter: SlashStorageModifications = await getSlashStorageModifications(testEnv.staker, account);

  const enoughStake = storageStateBefore.stakeOf.gte(amount);
  const stakeRemoved = storageStateBefore.stakeOf.lte(amount);
  const remainingAmountToBeSlashed = enoughStake ? new BN(0) : amount.sub(storageStateBefore.stakeOf);
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

  const storageStateExpected: SlashStorageModifications = {
    //[StakeStorage]
    stakeOf: enoughStake ? storageStateBefore.stakeOf.sub(amount) : new BN(0),
    totalStake: storageStateBefore.stakeOf.gte(amount)
      ? storageStateBefore.totalStake.sub(amount)
      : storageStateBefore.totalStake.sub(storageStateBefore.stakeOf),
    totalUnstake: storageStateBefore.totalUnstake.add(remainingAmountToBeSlashedFromUnstakes).sub(remainingAmountToBeSlashed),
    unstakes: expectedUnstakes,
    //[StakeTimesStorage]
    stakesTimestampOf: stakeRemoved ? null : storageStateBefore.stakesTimestampOf,
    lastStakeTimestampOf: stakeRemoved ? null : storageStateBefore.lastStakeTimestampOf,
  };

  expect.soft(replaceRNPropsWithStrings(storageStateAfter)).to.deep.equal(replaceRNPropsWithStrings(storageStateExpected));

  if (result !== undefined && result.eqn(0) && amount.gt(remainingAmountToBeSlashedFromUnstakes)) {
    expect.soft(replaceRNPropsWithStrings(txRes.events)).to.deep.equal([
      {
        name: 'Slashed',
        args: {
          account: account.address,
          amount: amount.sub(remainingAmountToBeSlashedFromUnstakes).toString(),
        },
      },
    ]);
  }
  expect.flushSoft();
}

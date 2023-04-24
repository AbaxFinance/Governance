import { KeyringPair } from '@polkadot/keyring/types';
import { AccountId, Balance, E12, ProposalId, Timestamp } from 'scripts/types_and_consts';
import Governor from 'typechain/contracts/governor';
import { StakeError, Unstake } from 'typechain/types-returns/staker';
import { expect } from 'tests/setup/chai';
import { TestEnv } from '../../make-suite';
import { replaceRNPropsWithStrings } from '../../misc';
import { BN } from 'bn.js';
import { ReturnNumber } from '@727-ventures/typechain-types';
import { numbersToHex } from 'tests/utlis/converters/hex-number';
import { Hash } from 'typechain/types-returns/governor';

export interface SlashVoterStorageModifications {
  //[GovernorRewardableSlashableStorage]
  claimedOrSlashed: boolean;
  //[StakeStorage]
  stakeOf: Balance;
  totalStake: Balance;
  totalUnstake: Balance;
  unstakes: Unstake[];
  //[StakeTimesStorage]
  stakesTimestampOf: Timestamp | null;
  lastStakeTimestampOf: Timestamp | null;
}

export async function getSlashVoterStorageModifications(
  governor: Governor,
  account: AccountId,
  proposalId: number[],
): Promise<SlashVoterStorageModifications> {
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  return {
    //[GovernorRewardableSlashableStorage]
    claimedOrSlashed: (await governor.query.claimedOrSlashed(account, proposalId)).value.ok!,
    //[StakeStorage]
    stakeOf: (await governor.query.stakeOf(account)).value.ok!.rawNumber,
    totalStake: (await governor.query.totalStake()).value.ok!.rawNumber,
    totalUnstake: (await governor.query.totalUnstake()).value.ok!.rawNumber,
    unstakes: (await governor.query.initializedUnstakesOf(account)).value.ok!,
    //[StakeTimesStorage]
    stakesTimestampOf: (await governor.query.stakeTimestampOf(account)).value.ok!,
    lastStakeTimestampOf: (await governor.query.lastStakeTimestampOf(account)).value.ok!,
  };
  /* eslint-enable @typescript-eslint/no-non-null-assertion */
}

export async function slashVoterAndCheck(
  testEnv: TestEnv,
  caller: KeyringPair,
  account: AccountId,
  proposalId: number[],
  error?: StakeError | undefined,
) {
  const governor: Governor = testEnv.governor;

  const storageStateBefore: SlashVoterStorageModifications = await getSlashVoterStorageModifications(testEnv.governor, account, proposalId);

  const queryRes = (await governor.withSigner(caller).query.slashVoter(account, proposalId)).value.ok!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  if (error !== undefined) {
    expect(queryRes).to.have.deep.property('err', error);
    return;
  }

  //// need to take it befoer tx as slashing changes the result!!!!
  const state = (await governor.query.state(proposalId)).value.ok!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  const rules = (await governor.query.rules(state.rulesId)).value.ok!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  const stakeAndUnstakesInitializedAfter = (await governor.query.stakeAndUnstakesInitializedAfter(account, state.start)).value.ok!.rawNumber; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  const amount = stakeAndUnstakesInitializedAfter.mul(new BN(rules.voterSlashPartE12.toString())).div(E12); // eslint-disable-line @typescript-eslint/no-non-null-assertion
  ////

  const tx = governor.withSigner(caller).tx.slashVoter(account, proposalId);
  await expect(tx).to.eventually.be.fulfilled;
  const txRes = await tx;

  const storageStateAfter: SlashVoterStorageModifications = await getSlashVoterStorageModifications(testEnv.governor, account, proposalId);

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

  const storageStateExpected: SlashVoterStorageModifications = {
    //[GovernorRewardableSlashableStorage]
    claimedOrSlashed: true,
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

  expect.soft(replaceRNPropsWithStrings(txRes.events)).to.deep.equal([
    {
      name: 'Slashed',
      args: {
        account: account,
        amount: amount.sub(remainingAmountToBeSlashedFromUnstakes).toString(),
      },
    },
    {
      name: 'VoterSlashed',
      args: {
        account: account,
        proposalId: '0x' + numbersToHex(proposalId as number[]),
      },
    },
  ]);

  expect.flushSoft();
}

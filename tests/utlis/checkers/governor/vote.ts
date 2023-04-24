import { KeyringPair } from '@polkadot/keyring/types';
import { AccountId, Balance, ProposalId, Timestamp } from 'scripts/types_and_consts';
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

export interface VoteStorageModifications {
  //[GovernorStorage]
  state: ProposalState;
  vote_of: UserVote | null;
}

export async function getVoteStorageModifications(governor: Governor, account: AccountId, proposal_id: Hash): Promise<VoteStorageModifications> {
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  return {
    //[GovernorStorage]
    state: (await governor.query.state(proposal_id)).value.ok!,
    vote_of: (await governor.query.voteOfFor(account, proposal_id)).value.ok!,
  };
  /* eslint-enable @typescript-eslint/no-non-null-assertion */
}

export async function voteAndCheck(testEnv: TestEnv, caller: KeyringPair, proposalId: Hash, vote: Vote, error?: GovernError | undefined) {
  const governor: Governor = testEnv.governor;
  const timestampProvider: BlockTimestampProvider = testEnv.timestampProvider;

  const storageStateBefore: VoteStorageModifications = await getVoteStorageModifications(governor, caller.address, proposalId);
  const timestamp = (await timestampProvider.query.getBlockTimestamp()).value.ok!; // eslint-disable-line @typescript-eslint/no-non-null-assertion

  const queryRes = (await governor.withSigner(caller).query.vote(proposalId, vote, [])).value.ok;
  if (error !== undefined) {
    expect(queryRes).to.have.deep.property('err', error);
    return;
  }

  // const api = await apiProviderWrapper.getAndWaitForReady();
  // const governor2 = new ContractPromise(api, governor.abi, governor.address);

  const tx = governor.withSigner(caller).tx.vote(proposalId, vote, []);
  await expect(tx).to.eventually.be.fulfilled;
  const txRes = await tx;

  const storageStateAfter: VoteStorageModifications = await getVoteStorageModifications(governor, caller.address, proposalId);

  const counterAtStart = (await governor.query.counterStake()).value.ok!;
  const totalStake = (await governor.query.totalStake()).value.ok!;

  const stakeOf = (await governor.query.stakeOf(caller.address)).value.ok!;

  const storageStateExpected: VoteStorageModifications = {
    //[GovernorStorage]
    state: {
      status: ProposalStatus.active,
      proposer: storageStateBefore.state.proposer,
      voterRewardPartE12: storageStateBefore.state.voterRewardPartE12,
      rulesId: storageStateBefore.state.rulesId,
      start: storageStateBefore.state.start,
      votesAtStart: storageStateBefore.state.votesAtStart,
      counterAtStart: storageStateBefore.state.counterAtStart,
      finlalized: storageStateBefore.state.finlalized,
      votesFor: new ReturnNumber(
        storageStateBefore.state.votesFor.rawNumber
          .add(vote === Vote.agreed ? stakeOf.rawNumber : new BN(0))
          .sub(
            storageStateBefore.vote_of !== null && storageStateBefore.vote_of.vote === Vote.agreed
              ? storageStateBefore.vote_of.amount.rawNumber
              : new BN(0),
          ),
      ),
      votesAgainst: new ReturnNumber(
        storageStateBefore.state.votesAgainst.rawNumber
          .add(vote === Vote.disagreed ? stakeOf.rawNumber : new BN(0))
          .sub(
            storageStateBefore.vote_of !== null && storageStateBefore.vote_of.vote === Vote.disagreed
              ? storageStateBefore.vote_of.amount.rawNumber
              : new BN(0),
          ),
      ),
      votesAgainstWithSlash: new ReturnNumber(
        storageStateBefore.state.votesAgainstWithSlash.rawNumber
          .add(vote === Vote.disagreedWithProposerSlashing ? stakeOf.rawNumber : new BN(0))
          .sub(
            storageStateBefore.vote_of !== null && storageStateBefore.vote_of.vote === Vote.disagreedWithProposerSlashing
              ? storageStateBefore.vote_of.amount.rawNumber
              : new BN(0),
          ),
      ),
    },
    vote_of: {
      vote: vote,
      amount: stakeOf,
    },
  };

  expect.soft(replaceRNPropsWithStrings(storageStateAfter)).to.deep.equal(replaceRNPropsWithStrings(storageStateExpected));

  expect.soft(replaceRNPropsWithStrings(txRes.events)).to.deep.equal([
    {
      name: 'VoteCasted',
      args: {
        account: caller.address,
        proposalId: '0x' + numbersToHex(proposalId as number[]),
        vote: vote,
      },
    },
  ]);
  expect.flushSoft();
}

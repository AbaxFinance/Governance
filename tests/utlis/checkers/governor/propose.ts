import { KeyringPair } from '@polkadot/keyring/types';
import { Balance, ProposalId, Timestamp } from 'scripts/types_and_consts';
import Governor from 'typechain/contracts/governor';
import BlockTimestampProvider from 'typechain/contracts/block_timestamp_provider';
import { StakeError, Unstake } from 'typechain/types-returns/staker';
import { expect } from 'tests/setup/chai';
import { TestEnv } from '../../make-suite';
import { replaceRNPropsWithStrings } from '../../misc';
import { ReturnNumber } from '@727-ventures/typechain-types';
import { GovernError, ProposalState, ProposalStatus } from 'typechain/types-returns/governor';
import { Hash, Proposal } from 'typechain/types-arguments/governor';
import BN from 'bn.js';
import { ContractPromise } from '@polkadot/api-contract';
import { apiProviderWrapper } from 'tests/setup/helpers';
import { numberToHex } from '@polkadot/util';
import { numbersToHex } from 'tests/utlis/converters/hex-number';

export interface ProposeStorageModifications {
  //[GovernorStorage]
  state: ProposalState;
}

export async function getProposeStorageModifications(governor: Governor, proposal_id: Hash): Promise<ProposeStorageModifications> {
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  return {
    //[GovernorStorage]
    state: (await governor.query.state(proposal_id)).value.ok!,
  };
  /* eslint-enable @typescript-eslint/no-non-null-assertion */
}

export async function proposeAndCheck(
  testEnv: TestEnv,
  caller: KeyringPair,
  proposal: Proposal,
  description: string,
  error?: GovernError | undefined,
) {
  const governor: Governor = testEnv.governor;
  const timestampProvider: BlockTimestampProvider = testEnv.timestampProvider;

  const proposalHash = (await testEnv.hasher.query.hashProposalWithDescription(proposal, description)).value.ok!; // eslint-disable-line @typescript-eslint/no-non-null-assertion

  const storageStateBefore: ProposeStorageModifications = await getProposeStorageModifications(governor, proposalHash);
  const timestamp = (await timestampProvider.query.getBlockTimestamp()).value.ok!; // eslint-disable-line @typescript-eslint/no-non-null-assertion

  const queryRes = (await governor.withSigner(caller).query.propose(proposal, description)).value.ok;
  if (error !== undefined) {
    expect(queryRes).to.have.deep.property('err', error);
    return;
  }

  // const api = await apiProviderWrapper.getAndWaitForReady();
  // const governor2 = new ContractPromise(api, governor.abi, governor.address);

  const tx = governor.withSigner(caller).tx.propose(proposal, description);
  await expect(tx).to.eventually.be.fulfilled;
  const txRes = await tx;

  const storageStateAfter: ProposeStorageModifications = await getProposeStorageModifications(governor, proposalHash);

  const counterAtStart = (await governor.query.counterStake()).value.ok!;
  const totalStake = (await governor.query.totalStake()).value.ok!;

  const storageStateExpected: ProposeStorageModifications = {
    //[GovernorStorage]
    state: {
      status: ProposalStatus.active,
      proposer: caller.address,
      voterRewardPartE12: Number(proposal.voterRewardPartE12.toString()),
      rulesId: Number(proposal.rulesId.toString()),
      start: timestamp,
      votesAtStart: totalStake,
      counterAtStart: counterAtStart,
      finalized: null,
      votesFor: new ReturnNumber(0),
      votesAgainst: new ReturnNumber(0),
      votesAgainstWithSlash: new ReturnNumber(0),
    },
  };

  expect.soft(replaceRNPropsWithStrings(storageStateAfter)).to.deep.equal(replaceRNPropsWithStrings(storageStateExpected));

  const expectedProposal: Proposal = {
    rulesId: proposal.rulesId,
    voterRewardPartE12: proposal.voterRewardPartE12,
    transactions: [],
  };
  for (let i = 0; i < proposal.transactions.length; i++) {
    expectedProposal.transactions.push({
      callee: proposal.transactions[i].callee,
      selector: ('0x' + numbersToHex(proposal.transactions[i].selector as number[])) as any,
      input: ('0x' + numbersToHex(proposal.transactions[i].input as number[])) as any,
      transferredValue: proposal.transactions[i].transferredValue.toString(),
    });
  }
  expect.soft(replaceRNPropsWithStrings(txRes.events)).to.deep.equal([
    {
      name: 'ProposalCreated',
      args: {
        proposalId: proposalHash,
        proposal: expectedProposal,
        description: 'Abax will be the best ;-)',
      },
    },
  ]);
  expect.flushSoft();
}

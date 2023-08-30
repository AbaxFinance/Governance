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
import { hexToNumbers, numbersToHex } from 'tests/utlis/converters/hex-number';
import { cloneDeep } from 'lodash';

export interface ExecuteStorageModifications {
  //[GovernorStorage]
  state: ProposalState;
}

export async function getExecuteStorageModifications(governor: Governor, proposal_id: Hash): Promise<ExecuteStorageModifications> {
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  const state = (await governor.query.state(proposal_id)).value.ok!;
  return {
    //[GovernorStorage]
    state: state,
  };
  /* eslint-enable @typescript-eslint/no-non-null-assertion */
}

export async function executeAndCheck(
  testEnv: TestEnv,
  caller: KeyringPair,
  proposal: Proposal,
  descriptionHash: number[],
  description: string,
  error?: GovernError | undefined,
) {
  const governor: Governor = testEnv.governor;
  const queryRes = (await governor.withSigner(caller).query.execute(proposal, descriptionHash)).value.ok;
  if (error !== undefined) {
    expect(queryRes).to.have.deep.property('err', error);
    return;
  }

  const proposalId = hexToNumbers(((await governor.query.hashProposal(proposal, description)).value.ok as string).substring(2)); // eslint-disable-line @typescript-eslint/no-non-null-assertion

  const storageStateBefore: ExecuteStorageModifications = await getExecuteStorageModifications(governor, proposalId);

  const tx = governor.withSigner(caller).tx.execute(proposal, descriptionHash);
  await expect(tx).to.eventually.be.fulfilled;
  const txRes = await tx;

  const storageStateAfter: ExecuteStorageModifications = await getExecuteStorageModifications(governor, proposalId);

  const storageStateExpected: ExecuteStorageModifications = cloneDeep(storageStateBefore);
  storageStateExpected.state.status = ProposalStatus.executed;

  expect.soft(replaceRNPropsWithStrings(storageStateAfter)).to.deep.equal(replaceRNPropsWithStrings(storageStateExpected));

  expect.soft(replaceRNPropsWithStrings(txRes.events)).to.deep.equal([
    {
      name: 'ProposalExecuted',
      args: {
        proposalId: '0x' + numbersToHex(proposalId as number[]),
      },
    },
  ]);

  expect.flushSoft();
}

import { ChildProcess } from 'child_process';
import { readContractsFromFile, restartAndRestoreNodeState, sleep } from 'tests/setup/nodePersistence';

import { KeyringPair } from '@polkadot/keyring/types';
import { apiProviderWrapper } from 'tests/setup/helpers';

import PSP22Mintable from 'typechain/contracts/psp22_mintable';
import Governor from 'typechain/contracts/governor';
import Staker from 'typechain/contracts/staker';
import Hasher from 'typechain/contracts/hasher';
import GovernanceToken from 'typechain/contracts/governance_token';
import GovernanceTokenMinter from 'typechain/contracts/governance_token_minter';
import BlockTimestampProvider from 'typechain/contracts/block_timestamp_provider';

export interface TestEnv {
  users: KeyringPair[];
  deployer: KeyringPair;
  psp22Mintable: PSP22Mintable;
  staker: Staker;
  governor: Governor;
  govToken: GovernanceToken;
  timestampProvider: BlockTimestampProvider;
  hasher: Hasher;
  governanceTokenMinter: GovernanceTokenMinter;
}

function makeSuiteInternal(
  mode: 'none' | 'skip' | 'only',
  name: string,
  generateTests: (getTestEnv: () => TestEnv) => void,
  skipRegenerateEnvBeforeEach = false,
) {
  let hasAnyStoryStepFailed = false;
  (mode === 'none' ? describe : describe[mode])(`[Scenario Suite] ${name}`, () => {
    let suiteTestEnv: TestEnv;
    let getContractsNodeProcess: () => ChildProcess | undefined = () => undefined;
    before(async () => {
      if (!skipRegenerateEnvBeforeEach) return;

      getContractsNodeProcess = await restartAndRestoreNodeState(getContractsNodeProcess);
      await apiProviderWrapper.getAndWaitForReady();
      suiteTestEnv = await readContractsFromFile();
    });

    beforeEach(async function (this) {
      if (hasAnyStoryStepFailed && skipRegenerateEnvBeforeEach) {
        this.skip();
        return;
      }
      if (skipRegenerateEnvBeforeEach) {
        await apiProviderWrapper.getAndWaitForReady();
        return;
      }

      getContractsNodeProcess = await restartAndRestoreNodeState(getContractsNodeProcess);
      await apiProviderWrapper.getAndWaitForReady();
      suiteTestEnv = await readContractsFromFile();
    });

    generateTests(() => suiteTestEnv);

    afterEach(async function (this) {
      if (this.currentTest?.state === 'failed') {
        hasAnyStoryStepFailed = true;
        await sleep(1000);
      }
    });

    after(async () => {
      await apiProviderWrapper.closeApi();
      getContractsNodeProcess()?.kill();
    });
  });
}

export function makeSuite(name: string, generateTests: (getTestEnv: () => TestEnv) => void, skipRegenerateEnvBeforeEach = false) {
  makeSuiteInternal('none', name, generateTests, skipRegenerateEnvBeforeEach);
}
makeSuite.only = function (name: string, generateTests: (getTestEnv: () => TestEnv) => void, skipRegenerateEnvBeforeEach = false) {
  makeSuiteInternal('only', name, generateTests, skipRegenerateEnvBeforeEach);
};
makeSuite.skip = function (name: string, generateTests: (getTestEnv: () => TestEnv) => void, skipRegenerateEnvBeforeEach = false) {
  makeSuiteInternal('skip', name, generateTests, skipRegenerateEnvBeforeEach);
};

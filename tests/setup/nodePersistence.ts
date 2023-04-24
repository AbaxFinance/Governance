import { ChildProcess, spawn } from 'child_process';
import fs, { write } from 'fs-extra';
import chalk from 'chalk';
import path from 'path';
// import { TestEnv } from 'tests/scenarios/utils/make-suite';
import { getContractObject } from './deploymentHelpers';
import findProcess from 'find-process';
import { apiProviderWrapper, getSigners } from './helpers';
import PSP22Mintable from 'typechain/contracts/psp22_mintable';
import Staker from 'typechain/contracts/staker';
import Hasher from 'typechain/contracts/hasher';
import Governor from 'typechain/contracts/governor';
import GovernanceToken from 'typechain/contracts/governance_token';
import BlockTimestampProvider from 'typechain/contracts/block_timestamp_provider';
import { TestEnv } from 'tests/utlis/make-suite';

export const DEFAULT_DEPLOYED_CONTRACTS_INFO_PATH = `${path.join(__dirname, 'deployedContracts.json')}`;

interface StoredContractInfo {
  name: string;
  address: string;
  reserveName?: string;
}

export const saveContractInfoToFileAsJson = async (contractInfos: StoredContractInfo[], writePath = DEFAULT_DEPLOYED_CONTRACTS_INFO_PATH) => {
  await fs.writeJSON(writePath, contractInfos);
};

const logToFile = (data: string) => {
  if (!process.env.PWD) throw 'could not determine pwd';
  fs.appendFile(path.join(process.env.PWD, `substrate-contracts-node.testrun.log`), data, { encoding: 'utf-8' });
};
export const sleep = (waitTimeInMs) => new Promise((resolve) => setTimeout(resolve, waitTimeInMs));

export async function waitFor(valueGetter: () => any, logMessage = 'Waiting for value...') {
  while (!valueGetter()) {
    console.log(logMessage);
    await sleep(1000);
  }
}

const spawnContractsNode = async (testChainStateLocation: string) => {
  if (!process.env.PWD) throw 'could not determine pwd';
  const command = path.join(process.env.PWD, 'substrate-contracts-node');
  const cliArgs = [
    '--dev',
    '--base-path',
    `${testChainStateLocation}`,
    '--ws-max-connections',
    '1000',
    '--max-runtime-instances',
    '256',
    '--ws-port',
    '9944',
  ];
  const contractsNodeProcess = spawn(command, cliArgs, { cwd: process.env.PWD, stdio: 'overlapped' });

  contractsNodeProcess.on('exit', function (code) {
    if (code === null || code === 0) return code ?? 0;
    throw code;
  });
  contractsNodeProcess.on('error', function (err) {
    throw err;
  });

  const waitForStartupFinish = new Promise<ChildProcess>((resolve) => {
    const endOfBootSequenceStr = `Running JSON-RPC WS server: addr=127.0.0.1:9944`;

    contractsNodeProcess.stderr?.on('data', (data: string) => {
      logToFile(data);
      if (data.includes(endOfBootSequenceStr)) {
        resolve(contractsNodeProcess);
      }
    });
    contractsNodeProcess.stdout?.on('data', logToFile);
  });

  await waitForStartupFinish;
  return contractsNodeProcess;
};

export const restartAndRestoreNodeState = async (getOldContractsNodeProcess: () => ChildProcess | undefined) => {
  if (!process.env.PWD) throw 'could not determine pwd';
  const testChainStateLocation = path.join(process.env.PWD, 'test-chain-state');
  await apiProviderWrapper.closeApi();
  await restoreTestChainState(getOldContractsNodeProcess(), testChainStateLocation);
  const contractsNodeProcess = await spawnContractsNode(testChainStateLocation);

  contractsNodeProcess.stderr?.on('data', (data: string) => {
    logToFile(data);
  });
  contractsNodeProcess.stdout?.on('data', logToFile);

  await apiProviderWrapper.getAndWaitForReady();
  return () => contractsNodeProcess;
};

export const readContractsFromFile = async (writePath = DEFAULT_DEPLOYED_CONTRACTS_INFO_PATH): Promise<TestEnv> => {
  const contracts = JSON.parse(await fs.readFile(writePath, 'utf8')) as StoredContractInfo[];

  const [deployer, ...users] = getSigners();

  const timestampProviderContractInfo = contracts.find((c) => c.name === 'block_timestamp_provider');
  if (!timestampProviderContractInfo) throw 'timestampProvider ContractInfo  notfound';
  const timestampProvider = await getContractObject(BlockTimestampProvider, timestampProviderContractInfo.address, deployer);

  const governorContractInfo = contracts.find((c) => c.name === 'governor');
  if (!governorContractInfo) throw 'governor ContractInfo not found';
  const governor = await getContractObject(Governor, governorContractInfo.address, deployer);

  const govTokenContractInfo = contracts.find((c) => c.name === 'governance_token');
  if (!govTokenContractInfo) throw 'governorToken ContractInfo not found';
  const govToken = await getContractObject(GovernanceToken, govTokenContractInfo.address, deployer);

  const stakerContractInfo = contracts.find((c) => c.name === 'staker');
  if (!stakerContractInfo) throw 'staker ContractInfo not found';
  const staker = await getContractObject(Staker, stakerContractInfo.address, deployer);

  const psp22MintableContractInfo = contracts.find((c) => c.name === 'psp22_mintable');
  if (!psp22MintableContractInfo) throw 'psp22Mintable ContractInfo not found';
  const psp22Mintable = await getContractObject(PSP22Mintable, psp22MintableContractInfo.address, deployer);

  const hasherContractInfo = contracts.find((c) => c.name === 'hasher');
  if (!hasherContractInfo) throw 'hasher ContractInfo not found';
  const hasher = await getContractObject(Hasher, hasherContractInfo.address, deployer);

  return {
    users,
    deployer,
    staker,
    governor,
    govToken,
    timestampProvider,
    psp22Mintable,
    hasher,
  };
};

async function restoreTestChainState(oldContractsNodeProcess: ChildProcess | undefined, testChainStateLocation: string) {
  if (!process.env.PWD) throw 'could not determine pwd';
  const backupLocation = path.join(process.env.PWD, 'test-chain-state-bp');
  if (oldContractsNodeProcess) {
    oldContractsNodeProcess.kill();
  }

  const existingProcessesListeningOnPort = await findProcess('port', 9944, { logLevel: 'error' });
  for (const p of existingProcessesListeningOnPort) {
    console.log(chalk.yellow(`Killing process `) + chalk.magenta(p.name) + `(${chalk.italic(p.cmd)})` + ` occupying test port\n\n`);
    process.kill(p.pid);
  }

  fs.rmSync(testChainStateLocation, { force: true, recursive: true });
  fs.copySync(backupLocation, testChainStateLocation);
}

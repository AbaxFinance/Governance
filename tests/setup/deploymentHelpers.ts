import { ApiPromise } from '@polkadot/api';
import { CodePromise, ContractPromise } from '@polkadot/api-contract';
import { CodeSubmittableResult } from '@polkadot/api-contract/base';
import { KeyringPair } from '@polkadot/keyring/types';
import type { WeightV2 } from '@polkadot/types/interfaces';
import BN from 'bn.js';
import fs, { readFileSync } from 'fs-extra';
import path from 'path';

import { apiProviderWrapper, getSigners, getSignersWithoutOwner } from './helpers';
import { saveContractInfoToFileAsJson } from './nodePersistence';
import { ReserveTokenDeploymentData } from './testEnvConsts';
import { LINE_SEPARATOR, toE12 } from 'tests/utlis/misc';
import { TestEnv } from 'tests/utlis/make-suite';
import PSP22Mintable from 'typechain/contracts/psp22_mintable';
import Governor from 'typechain/contracts/governor';
import Staker from 'typechain/contracts/staker';
import GovernanceToken from 'typechain/contracts/governance_token';
import Hasher from 'typechain/contracts/hasher';
import BlockTimestampProvider from 'typechain/contracts/block_timestamp_provider';
import GovernanceTokenMinter from 'typechain/contracts/governance_token_minter';
import { AccountId, BURNER, Balance, DAY, E21, MINTER, Option, Timestamp } from 'scripts/types_and_consts';
import { ProposalRules } from 'typechain/types-returns/governor';
import { ReturnNumber } from '@727-ventures/typechain-types';
import { merge } from 'lodash';

const getCodePromise = (api: ApiPromise, contractName: string): CodePromise => {
  const abi = JSON.parse(readFileSync(`./artifacts/${contractName}.json`).toString());
  const wasm = readFileSync(`./artifacts/${contractName}.wasm`);

  return new CodePromise(api, abi, wasm);
};
export const setupContract = async (signer: KeyringPair, contractName: string, constructorName: string, ...constructorArgs: any[]) => {
  const api = await apiProviderWrapper.getAndWaitForReady();
  const codePromise = getCodePromise(api, contractName);
  // maximum gas to be consumed for the instantiation. if limit is too small the instantiation will fail.
  const MAX_CALL_WEIGHT = new BN(5_000_000_000).isubn(1);
  const PROOFSIZE = new BN(3_000_000);
  const gasLimit = api?.registry.createType('WeightV2', {
    refTime: MAX_CALL_WEIGHT,
    proofSize: PROOFSIZE,
  }) as WeightV2;

  // const milion = 1000000n;
  // const gasLimit = milion * milion;
  // const gasLimit = 3000n * 1000000n;
  // const gasLimitFromNetwork = api.consts.system.blockWeights
  //   ? (api.consts.system.blockWeights as unknown as { maxBlock: WeightV1 }).maxBlock
  //   : (api.consts.system.maximumBlockWeight as unknown as WeightV1);
  // // a limit to how much Balance to be used to pay for the storage created by the instantiation
  // if null is passed, unlimited balance can be used

  const storageDepositLimit = null;

  // used to derive contract address,
  // use null to prevent duplicate contracts
  const salt = new Uint8Array();

  const deployedContract = await new Promise<ContractPromise>((resolve, reject) => {
    let unsub: () => void;
    const tx = codePromise.tx[constructorName](
      {
        storageDepositLimit: null,
        // gasLimit: new BN(gasLimitFromNetwork.toString()).divn(2),
        gasLimit,
        salt: undefined,
        value: undefined,
      },
      ...constructorArgs,
    );
    tx.signAndSend(signer, (result: CodeSubmittableResult<'promise'>) => {
      const { status, dispatchError, contract } = result;
      if (status.isInBlock) {
        if (dispatchError || !contract) {
          reject(dispatchError?.toString());
        } else {
          resolve(contract);
        }

        unsub();
      }
    })
      .then((_unsub) => {
        unsub = _unsub;
      })
      .catch(reject);
  });

  return { signer, deployedContract };
};

const deployWithLog = async <T>(
  owner: KeyringPair,
  constructor: new (address: string, signer: KeyringPair, nativeAPI: ApiPromise) => T,
  contractName: string,
  ...deployArgs
) => {
  const ret = await setupContract(owner, contractName, 'new', ...deployArgs);
  if (process.env.DEBUG) console.log(`Deployed ${contractName}: ${ret.deployedContract.address.toString()}`);
  return getContractObject<T>(constructor, ret.deployedContract.address.toString(), ret.signer);
};

export const deployHasher = async (owner: KeyringPair) => await deployWithLog(owner, Hasher, 'hasher');

export const deployPSP22Mintable = async (owner: KeyringPair, initialSupply: Balance) =>
  await deployWithLog(owner, PSP22Mintable, 'psp22_mintable', initialSupply);

export const deployGovernor = async (
  owner: KeyringPair,
  want: string,
  unstakePeriod: BN | number | string,
  maximalNumberOfUnstakes: BN | number | string,
  rules: ProposalRules,
) => await deployWithLog(owner, Governor, 'governor', want, unstakePeriod, maximalNumberOfUnstakes, rules);

export const deployGovernanceToken = async (
  owner: KeyringPair,
  initialSupply: BN | number | string,
  name: string | null,
  symbol: string | null,
  decimals: number,
) => await deployWithLog(owner, GovernanceToken, 'governance_token', initialSupply, name, symbol, decimals);

export const deployStaker = async (
  owner: KeyringPair,
  want: string,
  unstakePeriod: BN | number | string,
  maximal_number_of_initialized_unstakes: number,
) => await deployWithLog(owner, Staker, 'staker', want, unstakePeriod, maximal_number_of_initialized_unstakes);

export const deployBlockTimestampProvider = async (owner: KeyringPair, shouldReturnMockValue = false) =>
  await deployWithLog(owner, BlockTimestampProvider, 'block_timestamp_provider', shouldReturnMockValue, owner.address);

export const deployGovernanceTokenMinter = async (owner: KeyringPair, govTokenAddress: string) => {
  return deployWithLog(owner, GovernanceTokenMinter, 'governance_token_minter', govTokenAddress);
};

// const getSelectorsFromMessages = (messages) => {
//   return messages.map((message) => {
//     return message.selector;
//   });
// };

// const getSelectorByName = (messages, name) => {
//   return messages.filter((message) => {
//     return message.label === name;
//   })[0].selector;
// };

// export const setupUpgradableContract = async <T>(
//   constructor: new (address: string, signer: KeyringPair, nativeAPI: ApiPromise) => T,
//   defaultSigner: KeyringPair,
//   owner: KeyringPair,
//   facetWithInitializeMethod: string,
//   facets: string[],
// ) => {
//   const api = await apiProviderWrapper.getAndWaitForReady();
//   const diamondContract = await deployWithLog(defaultSigner, DiamondContract, 'diamond', owner.address);
//   const initCodePromise = getCodePromise(api, facetWithInitializeMethod);

//   //await api.tx.contracts.uploadCode(initCodePromise.code, null);
//   await deployWithLog(defaultSigner, constructor, facetWithInitializeMethod);

//   const initCodeHash = (initCodePromise.abi.json.source as any).hash as string;
//   const initMessages = (initCodePromise.abi.json as any).spec.messages;
//   const initSelector = getSelectorByName(initMessages, 'initialize_contract');
//   const initSelectors = getSelectorsFromMessages(initMessages);
//   const initCut: FacetCut[] = [{ hash: initCodeHash, selectors: initSelectors }];

//   await diamondContract.query.diamondCut(initCut, {
//     hash: initCodeHash,
//     selector: initSelector,
//     input: [],
//   });
//   await diamondContract.tx.diamondCut(initCut, {
//     hash: initCodeHash,
//     selector: initSelector,
//     input: [],
//   });

//   const initCutRemove = [{ hash: initCodeHash, selectors: [] }];
//   await diamondContract.tx.diamondCut(initCutRemove, null);

//   const cuts: FacetCut[] = [];
//   for (const facet of facets) {
//     const facetCodePromise = getCodePromise(api, facet);
//     //await api.tx.contracts.uploadCode(facetCodePromise.code, null);
//     await deployWithLog(defaultSigner, LendingPool, facet);
//     const facetCodeHash = (facetCodePromise.abi.json.source as any).hash as string;
//     const facetMessages = (facetCodePromise.abi.json.V3 as any).spec.messages;
//     const facetSelectors = getSelectorsFromMessages(facetMessages);
//     cuts.push({ hash: facetCodeHash, selectors: facetSelectors });
//   }
//   await diamondContract.tx.diamondCut(cuts, null);

//   return new constructor(diamondContract.address, defaultSigner, api);
// };

export const getContractObject = async <T>(
  constructor: new (address: string, signer: KeyringPair, nativeAPI: ApiPromise) => T,
  contractAddress: string,
  signerPair: KeyringPair,
) => {
  return new constructor(contractAddress, signerPair, await apiProviderWrapper.getAndWaitForReady());
};
//reserveDatas: ReserveTokenDeploymentData
export async function deployCoreContracts(config: DeploymentConfig): Promise<{
  govToken: GovernanceToken;
  governor: Governor;
  staker: Staker;
  timestampProvider: BlockTimestampProvider;
  psp22Mintable: PSP22Mintable;
  hasher: Hasher;
}> {
  if (process.env.DEBUG) {
    console.log(LINE_SEPARATOR);
    console.log('Deploying contracts');
    console.log(LINE_SEPARATOR);
    console.log(`Deployer: ${config.deployer.address}`);
  }
  const governorConfig = config.governorConfig;
  const govTokenConfig = config.govTokenConfig;
  const stakerConfig = config.stakerConfig;
  let governor: Governor;
  let govToken: GovernanceToken;
  if (governorConfig.want !== null) {
    // TODO #0 load existing govToken
    throw 'deployCoreConttracts::#0';
    // govToken = await getContractObject(governorConfig.want, config.deployer)
    // governor = await deployGovernor(config.deployer, governorConfig.want, governorConfig.unstake_period, governorConfig.rules);
  } else {
    govToken = await deployGovernanceToken(
      config.deployer,
      govTokenConfig.initialSupply,
      govTokenConfig.name,
      govTokenConfig.symbol,
      govTokenConfig.decimals,
    );
    governor = await deployGovernor(
      config.deployer,
      govToken.address,
      governorConfig.unstake_period,
      governorConfig.maximalNumberOfUnstakes,
      governorConfig.rules,
    );
  }

  const psp22Mintable = await deployPSP22Mintable(config.deployer, new BN('1000000000000000000000000000000')); // 10^30

  const staker: Staker = await deployStaker(
    config.deployer,
    psp22Mintable.address,
    stakerConfig.unstake_period,
    stakerConfig.maximal_number_of_initialized_unstakes,
  );

  const timestampProvider = await deployBlockTimestampProvider(config.deployer, config.shouldUseMockTimestamp);
  const hasher = await deployHasher(config.deployer);

  return { govToken, governor, staker, timestampProvider, psp22Mintable, hasher };
}

export interface ProductionDeploymentParams {
  owner: KeyringPair;

  reserveDatas: ReserveTokenDeploymentData[];
}

const getEntryOrThrow = <T>(record: Record<string, T>, key: string) => {
  if (!(key in record)) throw new Error(`Key "${key}" not found in record ${record}`);
  const value = record[key];
  return value;
};

export type GovernorConfig = {
  want: Option<AccountId>;
  unstake_period: Timestamp;
  maximalNumberOfUnstakes: number;
  rules: ProposalRules;
};

export type StakerConfig = {
  want: Option<AccountId>;
  unstake_period: Timestamp;
  maximal_number_of_initialized_unstakes: number;
};

export const defaultProposalRules: ProposalRules = {
  minimumStakePartE12: toE12(0.01),
  deposit: new ReturnNumber(0), // TODO toE12(1000),
  initialPeriod: 3 * DAY,
  flatPeriod: 7 * DAY,
  finalPeriod: 4 * DAY,
  maximalVoterRewardPartE12: toE12(0.05),
  voterSlashPartE12: toE12(0.2),
  proposerSlashPartE12: toE12(0.5),
};

export const defaultGovernorConfig = {
  want: null,
  unstake_period: 21 * DAY,
  maximalNumberOfUnstakes: 3,
  rules: defaultProposalRules,
};

export const defaultStakerConfig = {
  want: null,
  unstake_period: 21 * DAY,
  maximal_number_of_initialized_unstakes: 3,
};

export type GovTokenConfig = {
  initialSupply: Balance;
  name: Option<string>;
  symbol: Option<string>;
  decimals: number;
};

export const defaultGovTokenConfig: GovTokenConfig = {
  initialSupply: E21,
  name: 'ABAX',
  symbol: 'ABAX',
  decimals: 12,
};

export type DeploymentConfig = {
  shouldUseMockTimestamp: boolean;
  deployer: KeyringPair;
  users: KeyringPair[];
  governorConfig: GovernorConfig;
  govTokenConfig: GovTokenConfig;
  stakerConfig: StakerConfig;
};

export const defaultDeploymentConfig: DeploymentConfig = {
  shouldUseMockTimestamp: true,
  deployer: getSigners()[0],
  users: getSignersWithoutOwner(getSigners(), 0),
  governorConfig: defaultGovernorConfig,
  govTokenConfig: defaultGovTokenConfig,
  stakerConfig: defaultStakerConfig,
};
type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[] ? RecursivePartial<U>[] : T[P] extends object | undefined ? RecursivePartial<T[P]> : T[P];
};

export const deployAndConfigureSystem = async (
  deploymentConfigOverrides: RecursivePartial<DeploymentConfig> = defaultDeploymentConfig,
  saveConfigToFilePath?: string,
): Promise<TestEnv> => {
  const config: DeploymentConfig = merge(defaultDeploymentConfig, deploymentConfigOverrides);

  const { deployer, users } = config;

  const { govToken, governor, staker, timestampProvider, psp22Mintable, hasher } = await deployCoreContracts(config);

  await govToken.withSigner(deployer).tx.grantRole(0, governor.address);
  await govToken.withSigner(deployer).tx.grantRole(MINTER, governor.address);
  await govToken.withSigner(deployer).tx.grantRole(BURNER, governor.address);

  await govToken.withSigner(deployer).tx.transfer(governor.address, config.govTokenConfig.initialSupply.muln(96).divn(100), []);

  await governor.tx.setTimestampProvider(timestampProvider.address);
  await staker.tx.setTimestampProvider(timestampProvider.address);

  //FOR ETHWARSAW TESTING PURPOSES
  const governanceTokenMinter = await deployGovernanceTokenMinter(deployer, govToken.address);
  // await govToken.withSigner(deployer).tx.grantRole(MINTER, governanceTokenMinter.address);

  // await governanceTokenMinter.withSigner(deployer).tx.mint();
  // await govToken.withSigner(deployer).tx.approve(governor.address, '100000');
  // await governor.withSigner(deployer).tx.stake('100000');
  //FOR ETHWARSAW TESTING PURPOSES

  await govToken.withSigner(deployer).tx.renounceRole(0, deployer.address);

  const testEnv: TestEnv = {
    deployer,
    users,
    staker,
    governor,
    govToken,
    timestampProvider,
    psp22Mintable,
    hasher,
    governanceTokenMinter,
  };

  if (saveConfigToFilePath) {
    await saveConfigToFile(testEnv, saveConfigToFilePath);
  }
  return testEnv;
};

async function saveConfigToFile(testEnv: TestEnv, writePath: string) {
  await saveContractInfoToFileAsJson(
    [
      {
        name: testEnv.governor.name,
        address: testEnv.governor.address,
      },
      {
        name: testEnv.govToken.name,
        address: testEnv.govToken.address,
      },
      {
        name: testEnv.timestampProvider.name,
        address: testEnv.timestampProvider.address,
      },
      {
        name: testEnv.staker.name,
        address: testEnv.staker.address,
      },
      {
        name: testEnv.psp22Mintable.name,
        address: testEnv.psp22Mintable.address,
      },
      {
        name: testEnv.hasher.name,
        address: testEnv.hasher.address,
      },
      {
        name: testEnv.governanceTokenMinter.name,
        address: testEnv.governanceTokenMinter.address,
      },
    ],
    writePath,
  );
}

import { deployAndConfigureSystem } from 'tests/setup/deploymentHelpers';
import path from 'path';
import chalk from 'chalk';
import { apiProviderWrapper } from 'tests/setup/helpers';
import { argvObj } from 'scripts/compile/common';
import Keyring from '@polkadot/keyring';

(async (args: Record<string, string>) => {
  if (require.main !== module) return;
  const shouldUseMockTimestamp = false;
  const outputJsonFolder = (args['path'] as string) ?? process.argv[2] ?? process.env.PWD;
  if (!outputJsonFolder) throw 'could not determine path';
  const wsEndpoint = process.env.WS_ENDPOINT;
  if (!wsEndpoint) throw 'could not determine wsEndpoint';
  const seed = process.env.SEED;
  if (!seed) throw 'could not determine seed';
  const api = await apiProviderWrapper.getAndWaitForReady();

  const timestamp = await api.query.timestamp.now();
  console.log(new Date(parseInt(timestamp.toString())));

  const keyring = new Keyring();
  const deployer = keyring.createFromUri(seed, {}, 'sr25519');
  const deployPath = path.join(outputJsonFolder, 'deployedContracts.azero.testnet.json');

  await deployAndConfigureSystem({ shouldUseMockTimestamp, deployer }, deployPath);
  api.disconnect();
  process.exit(0);
})(argvObj).catch((e) => {
  console.log(e);
  console.error(chalk.red(JSON.stringify(e, null, 2)));
  process.exit(1);
});

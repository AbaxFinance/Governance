import { deployAndConfigureSystem } from 'tests/setup/deploymentHelpers';
import path from 'path';
import chalk from 'chalk';
import { apiProviderWrapper } from 'tests/setup/helpers';
import { argvObj } from 'scripts/compile/common';
import Keyring from '@polkadot/keyring';
import { ReturnNumber } from '@727-ventures/typechain-types';
import { DAY } from 'scripts/types_and_consts';

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

  await deployAndConfigureSystem(
    {
      shouldUseMockTimestamp,
      deployer,
      governorConfig: {
        rules: {
          minimumStakePartE12: 0, //toE12(0.01),
          deposit: new ReturnNumber(0), // TODO toE12(1000),
          initialPeriod: 1 * DAY, //3 * DAY,
          flatPeriod: 2 * DAY, //7 * DAY,
          finalPeriod: 1 * DAY, //4 * DAY,
          maximalVoterRewardPartE12: 0, //toE12(0.05),
          voterSlashPartE12: 0, //toE12(0.2),
          proposerSlashPartE12: 0, //toE12(0.5),
        },
      },
    },
    deployPath,
  );
  api.disconnect();
  process.exit(0);
})(argvObj).catch((e) => {
  console.log(e);
  console.error(chalk.red(JSON.stringify(e, null, 2)));
  process.exit(1);
});

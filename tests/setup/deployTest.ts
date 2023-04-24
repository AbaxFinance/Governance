import { deployAndConfigureSystem } from 'tests/setup/deploymentHelpers';
import path from 'path';
import chalk from 'chalk';
import { apiProviderWrapper } from 'tests/setup/helpers';
import { argvObj } from 'scripts/compile/common';

(async (args: Record<string, string>) => {
  if (require.main !== module) return;
  const outputJsonFolder = args['path'] ?? process.env.PWD;
  const shouldUseMockTimestamp = (args['shouldUseMockTimestamp'] === 'true' || args['shouldUseMockTimestamp'] === '1') ?? true;
  if (!outputJsonFolder) throw 'could not determine path';
  const api = await apiProviderWrapper.getAndWaitForReady();
  const deployPath = path.join(outputJsonFolder, 'tests/setup/deployedContracts.json');

  await deployAndConfigureSystem({ shouldUseMockTimestamp }, deployPath);
  api.disconnect();
  process.exit(0);
})(argvObj).catch((e) => {
  console.log(e);
  console.error(chalk.red(JSON.stringify(e, null, 2)));
  process.exit(1);
});

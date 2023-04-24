import chalk from 'chalk';
import fs from 'fs-extra';
import glob from 'glob';
import { argvObj, compileContractByNameAndCopyArtifacts } from './common';

const getAllContractNames = (contractsRootPath: string, regexFilter?: string | undefined) => {
  const names: string[] = [];
  const paths = glob.sync(`${contractsRootPath}/**/Cargo.toml`);
  const maybeRegexFilter = regexFilter ? new RegExp(regexFilter) : null;
  for (const p of paths) {
    const data = fs.readFileSync(p, 'utf8');
    if (data.includes(`[package]\nname =`)) {
      const result = data.match(/\[package\]\nname =( ){0,}"(.*)"/);
      if (!result) {
        console.warn(`Found Cargo.toml in ${p} but failed to determine contract name`);
        continue;
      }
      const contractName = result[2];
      if (!maybeRegexFilter || contractName.match(maybeRegexFilter)) {
        console.log(`Found contract ${contractName}!`);
        names.push(contractName);
      }
    }
  }
  return names;
};

(async (args: Record<string, unknown>) => {
  if (require.main !== module) return;
  const contractsRootPath = './src/contracts';

  const regex = (args['r'] ?? args['regex']) as string | undefined;
  const contractNames = getAllContractNames(contractsRootPath, regex);
  for (const name of contractNames) {
    await compileContractByNameAndCopyArtifacts(contractsRootPath, name);
  }
  console.log('All contracts compiled successfuly!');
  process.exit(0);
})(argvObj).catch((e) => {
  console.error(`Aborting...`);
  console.error(chalk.red(JSON.stringify(e, null, 2)));
  process.exit(1);
});

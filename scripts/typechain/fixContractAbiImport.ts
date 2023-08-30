import fs from 'fs-extra';
import glob from 'glob';
import { argvObj } from '../compile/common';
import chalk from 'chalk';

const fixContractAbiImports = (contractsRootPath: string, isDebug = false) => {
  const filesChanged: string[] = [];
  const paths = glob.sync(`${contractsRootPath}/**/*.ts`);
  for (const p of paths) {
    let hasTheFileGotChanged = false;
    const data = fs.readFileSync(p, 'utf8');
    const replaced = data.replace(/import \{ ContractAbi \} from '..\/contract-info\/(.*)';/gm, (match, p1) => {
      const valueToInsert = `import ContractAbi from 'artifacts/${p1}.json';`;
      if (valueToInsert !== match) hasTheFileGotChanged = true;
      return valueToInsert;
    });
    if (isDebug) fs.writeFileSync(p + 'old', data, 'utf8');

    fs.writeFileSync(p, replaced, 'utf8');
    if (hasTheFileGotChanged) filesChanged.push(p);
  }
  return filesChanged;
};

(async (args: Record<string, unknown>) => {
  if (require.main !== module) return;
  const typechainOutputPath = process.argv[2] ?? './typechain';
  const isDebug = 'debug' in args;
  console.log('Starting fixing contract abi imports!');
  const filesChanged = fixContractAbiImports(typechainOutputPath, isDebug);
  console.log('Finished!\n Changed files:', filesChanged);
  process.exit(0);
})(argvObj).catch((e) => {
  console.log(e);
  console.error(chalk.red(JSON.stringify(e, null, 2)));
  process.exit(0);
});

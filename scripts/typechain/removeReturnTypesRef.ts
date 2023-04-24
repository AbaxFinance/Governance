import fs from 'fs-extra';
import glob from 'glob';
import { argvObj } from '../compile/common';
import chalk from 'chalk';

const replaceReturnTypesRef = (contractsRootPath: string, isDebug = false) => {
  const filesChanged: string[] = [];
  const paths = glob.sync(`${contractsRootPath}/**/*.ts`);
  for (const p of paths) {
    let hasTheFileGotChanged = false;
    const data = fs.readFileSync(p, 'utf8');
    const replaced = data.replace(/ReturnTypes\.AccountId/gm, (match) => {
      if (data.includes('import type * as ReturnTypes')) return match;
      hasTheFileGotChanged = true;
      return `AccountId`;
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
  console.log('Removing unnecessary ReturnTypes reference!');
  const filesChanged = replaceReturnTypesRef(typechainOutputPath, isDebug);
  console.log('Finished!\n Changed files:', filesChanged);
  process.exit(0);
})(argvObj).catch((e) => {
  console.log(e);
  console.error(chalk.red(JSON.stringify(e, null, 2)));
  process.exit(0);
});

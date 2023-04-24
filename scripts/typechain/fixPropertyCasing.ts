import fs from 'fs-extra';
import glob from 'glob';
import { argvObj } from '../compile/common';
import chalk from 'chalk';
export const snakeToCamel = (str: string) =>
  str.toLowerCase().replace(/([-_][a-z])/g, (group) => group.toUpperCase().replace('-', '').replace('_', ''));
const fixPropertiesCasing = (contractsRootPath: string, isDebug = false) => {
  const filesChanged: string[] = [];
  const paths = glob.sync(`${contractsRootPath}/**/*.ts`);
  for (const p of paths) {
    let hasTheFileGotChanged = false;
    const data = fs.readFileSync(p, 'utf8');
    const replaced = data.replace(/\b(.*): /gm, (match, p1) => {
      const isSnakeCase = (input: string) => /^([a-z]{1,})(_[a-z0-9]{1,})*$/.test(input);

      if (!isSnakeCase(p1)) return match;
      const valueToInsert = `${snakeToCamel(p1)}: `;
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
  console.log('Starting fixing property names casing!');
  const filesChanged = fixPropertiesCasing(typechainOutputPath, isDebug);
  console.log('Finished!\n Changed files:', filesChanged);
  process.exit(0);
})(argvObj).catch((e) => {
  console.log(e);
  console.error(chalk.red(JSON.stringify(e, null, 2)));
  process.exit(0);
});

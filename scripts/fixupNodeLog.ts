import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import chalk from 'chalk';
import fs from 'fs-extra';
import { argvObj } from './compile/common';

const printHelp = () => {
  console.log(chalk.yellow('Supply input file via') + chalk.green('--input <path> ') + chalk.yellow('or as a first argument of the script'));
  console.log(chalk.yellow('Supply output file via') + chalk.green('--output <path> ') + chalk.yellow('or as a second argument of the script'));
  console.log(`\nExample usages:`);
  console.log(chalk.cyan('npx ts-node ./ansiFileToHtml.ts --input ./myFile.txt --output ./outputFile.html'));
  console.log(chalk.cyan('npx ts-node ./ansiFileToHtml.ts ./myFile.txt ./outputFile.html'));
};
(async (args: Record<string, unknown>) => {
  if (require.main !== module) return;
  const inputFile = (args['input'] as string) ?? process.argv[2] ?? process.env.PWD;
  if (!inputFile) throw 'could not determine input path';
  if (!inputFile || !fs.pathExistsSync(inputFile)) {
    console.log(chalk.yellow('Invalid or missing arguments supplied!'));
    printHelp();
    process.exit(127);
  }

  const inputData = fs.readFileSync(inputFile, 'utf-8');
  const outputData = inputData.replace(/\[(.*)\]/g, (_, p1: string) => {
    const dataArray = p1.split(', ');
    if (dataArray.length === 32) {
      return encodeAddress(decodeAddress(Uint8Array.from(dataArray.map((s) => parseInt(s, 16)))));
    }
    return dataArray.join('');
  });
  fs.writeFileSync(`${inputFile.replace('.log', '')}.retouched.log`, outputData, 'utf-8');

  process.exit(0);
})(argvObj).catch((e) => {
  console.log(e);
  console.error(chalk.red(JSON.stringify(e, null, 2)));
  process.exit(1);
});

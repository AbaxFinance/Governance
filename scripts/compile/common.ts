import util from 'node:util';
import fs from 'fs-extra';
import { exec, spawn } from 'child_process';
import path from 'path';
import glob from 'glob';
export const execPromise = util.promisify(exec);

export const createFileWithDirectoriesSync = (filePath: string, data: string) => {
  fs.ensureFileSync(filePath);
  fs.writeFileSync(filePath, data);
};

export const compileContract = async (contractPath: string) => {
  const command = 'cargo';
  const args = ['+nightly', 'contract', 'build'];
  console.log(`running ${command} ${args.join(' ')}...`);

  return new Promise<number>((resolve, reject) => {
    const process = spawn(command, args, { cwd: contractPath, stdio: 'inherit' });
    process.stdout?.on('data', (data) => {
      console.log(data);
    });
    process.stderr?.on('data', (data) => {
      console.log(data);
    });
    process.on('exit', function (code) {
      if (code === null || code === 0) resolve(code ?? 0);
      reject(code);
    });
    process.on('error', function (err) {
      reject(err);
    });
  });
};

export const copyArtifacts = async (contractName: string) => {
  const artifactsCompileOutputPath = path.join('src', 'target', 'ink', contractName);
  const artifactsOutputPath = path.join('artifacts');
  console.log('Copying artifacts...');
  fs.ensureDirSync(artifactsOutputPath);
  fs.copyFileSync(path.join(artifactsCompileOutputPath, `${contractName}.contract`), path.join(artifactsOutputPath, `${contractName}.contract`));
  fs.copyFileSync(path.join(artifactsCompileOutputPath, `${contractName}.wasm`), path.join(artifactsOutputPath, `${contractName}.wasm`));
  fs.copyFileSync(path.join(artifactsCompileOutputPath, `${contractName}.json`), path.join(artifactsOutputPath, `${contractName}.json`));
};

const getContractsFolderPath = (contractsRootPath: string, contractName: string) => {
  const paths = glob.sync(`${contractsRootPath}/**/Cargo.toml`);
  for (const p of paths) {
    const data = fs.readFileSync(p);
    if (data.includes(`[package]\nname = "${contractName}"`)) {
      console.log(`Found contract ${contractName}!`);
      return path.dirname(p);
    }
  }
  throw new Error(`Contract ${contractName} not found`);
};

export const compileContractByNameAndCopyArtifacts = async (contractsRootPath: string, contractName: string) => {
  const contractFolderPath = getContractsFolderPath(contractsRootPath, contractName);
  console.log(`compiling contract ${contractName} from ${contractFolderPath}...`);
  try {
    await compileContract(contractFolderPath);
  } catch (e) {
    console.error(`Contract ${contractName} failed to compile`);
    throw e;
  }
  copyArtifacts(contractName);
};

export const argvObj = process.argv.reduce((acc, val, index) => {
  const isSingleHyphenArg = val[0] === '-' && val[1] !== '-';
  const isDoubleHyphenArg = val.substring(0, 2) !== '--' && val[2] !== '-';
  const equalsPosition = val.indexOf('=');
  const isEqualsArg = equalsPosition !== -1;
  if (!isSingleHyphenArg && !isDoubleHyphenArg && !isEqualsArg) return acc;
  if (isEqualsArg) {
    acc[val.substring(0, equalsPosition)] = val.substring(equalsPosition + 1);
    return acc;
  }
  acc[isSingleHyphenArg ? val.substring(1) : val.substring(2)] = process.argv[index + 1];
  return acc;
}, {} as Record<string, string>);

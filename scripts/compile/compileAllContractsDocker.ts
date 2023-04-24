import chalk from 'chalk';
import fs from 'fs-extra';
import glob from 'glob';
import { argvObj, compileContractByNameAndCopyArtifacts } from './common';
import util from 'util';
import { spawn, exec } from 'child_process';
const execPromise = util.promisify(exec);
const getAllContractNames = (contractsRootPath: string) => {
  const names: string[] = [];
  const paths = glob.sync(`${contractsRootPath}/**/Cargo.toml`);
  for (const p of paths) {
    const data = fs.readFileSync(p, 'utf8');
    if (data.includes(`[package]\nname =`)) {
      const result = data.match(/\[package\]\nname =( ){0,}"(.*)"/);
      if (!result) {
        console.warn(`Found Cargo.toml in ${p} but failed to determine contract name`);
        continue;
      }
      const contractName = result[2];
      console.log(`Found contract ${contractName}!`);
      names.push(contractName);
    }
  }
  return names;
};

const runDockerCompilation = async (contractName: string) => {
  const containerName = `build-env_${contractName}`;
  const { stderr, stdout } = await execPromise(`docker run -d -it --name ${containerName} abacus-contracts-build:latest`);
  console.log('spawn build env', { contractName, stderr, stdout });

  const p = spawn(`bash`, [`-c`, `docker exec -i ${containerName} yarn cs ${contractName}`], { cwd: process.env.PWD, stdio: 'overlapped' });
  const waitForCompilationToFinish = new Promise<number>((resolve) => {
    p.stdout?.on('data', (data) => {
      console.log(data.toString());
    });
    p.stderr?.on('data', (data) => {
      console.log(data.toString());
    });
    p.on('exit', function (code) {
      if (code === null || code === 0) {
        console.log('copying artifacts!');
        exec(`docker cp ${containerName}:/src/artifacts artifacts`, () => {
          resolve(code ?? 0);
        });
      }
      throw code;
    });
    p.on('error', function (err) {
      console.log(err.toString());
      throw err;
    });
  });

  return waitForCompilationToFinish;
};

(async (args: Record<string, unknown>) => {
  if (require.main !== module) return;
  const contractsRootPath = './contracts';
  const contractNames = getAllContractNames(contractsRootPath);

  const tearDown = async () => {
    for (const contractName of contractNames) {
      const containerName = `build-env_${contractName}`;
      const { stderr, stdout } = await execPromise(`docker rm -f ${containerName} `);
      console.log('kill', { contractName, stderr, stdout });
    }
  };
  try {
    const buildPromises: Promise<number>[] = [];
    for (const name of contractNames) {
      const compilationPromise = runDockerCompilation(name);
      buildPromises.push(compilationPromise);
    }

    await Promise.all(buildPromises);
  } catch (e) {
    console.log(e);
    console.log('catch');
    await tearDown();
    throw e;
  } finally {
    console.log('finally');
    await tearDown();
  }

  console.log('All contracts compiled successfuly!');
  process.exit(0);
})(argvObj).catch((e) => {
  console.error(`Aborting...`);
  console.error(chalk.red(JSON.stringify(e, null, 2)));
  process.exit(1);
});

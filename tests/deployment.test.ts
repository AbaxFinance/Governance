import { KeyringPair } from '@polkadot/keyring/types';
import BN from 'bn.js';
// import BlockTimestampProviderContract from '../typechain/contracts/block_timestamp_provider';
import Governor from '../typechain/contracts/governor';
import GovernanceToken from 'typechain/contracts/governance_token';
import { TestEnv, makeSuite } from './utlis/make-suite';
import { BURNER, DAY, E12, E21, MINTER } from 'scripts/types_and_consts';
import { expect } from './setup/chai';

makeSuite('Contract setup tests', (getTestEnv) => {
  let testEnv: TestEnv;
  let deployer: KeyringPair;
  let users: KeyringPair[];
  let governor: Governor;
  let govToken: GovernanceToken;
  beforeEach(async () => {
    testEnv = getTestEnv();
    deployer = testEnv.deployer;
    users = testEnv.users;
    governor = testEnv.governor;
    govToken = testEnv.govToken;
  });

  describe(`After deployment ...`, () => {
    describe('Governance token...', () => {
      describe('has properly set ...', () => {
        describe('psp22::data', () => {
          it(`total supply`, async () => {
            const queryRes = (await govToken.query.totalSupply()).value.ok!;
            expect(queryRes.rawNumber.toString()).to.be.equal(E21.toString());
          });
          it(`balance of deployer`, async () => {
            const queryRes = (await govToken.query.balanceOf(deployer.address)).value.ok!;
            expect(queryRes.rawNumber.toString()).to.be.equal(E21.muln(4).divn(100).toString());
          });
          it(`balance of governor`, async () => {
            const queryRes = (await govToken.query.balanceOf(governor.address)).value.ok!;
            expect(queryRes.rawNumber.toString()).to.be.equal(E21.muln(96).divn(100).toString());
          });
        });
        describe(`psp22::metadata::data`, () => {
          it(`token name`, async () => {
            const queryRes = (await govToken.query.tokenName()).value.ok!;
            expect(queryRes).to.be.equal(('0x' + Buffer.from('ABAX', 'utf8').toString('hex')) as any as number[]);
          });
          it(`token symbol`, async () => {
            const queryRes = (await govToken.query.tokenSymbol()).value.ok!;
            expect(queryRes).to.be.equal(('0x' + Buffer.from('ABAX', 'utf8').toString('hex')) as any as number[]);
          });
          it(`token decimals`, async () => {
            const queryRes = (await govToken.query.tokenDecimals()).value.ok!;
            expect(queryRes).to.be.equal(12);
          });
        });
        describe(`access_control::Data`, () => {
          it(`deployer hasn't admin role`, async () => {
            const queryRes = (await govToken.query.hasRole(0, deployer.address)).value.ok!;
            expect(queryRes).to.be.equal(false);
          });
          it(`governor has admin role`, async () => {
            const queryRes = (await govToken.query.hasRole(0, governor.address)).value.ok!;
            expect(queryRes).to.be.equal(true);
          });
          it(`governor has MINTER role`, async () => {
            const queryRes = (await govToken.query.hasRole(MINTER, governor.address)).value.ok!;
            expect(queryRes).to.be.equal(true);
          });
          it(`governor has BURNER role`, async () => {
            const queryRes = (await govToken.query.hasRole(BURNER, governor.address)).value.ok!;
            expect(queryRes).to.be.equal(true);
          });
        });
      });
    });
    describe(`Governor Contract...`, () => {
      describe('has properly set', () => {
        describe('ownable::Data', () => {
          it('is self-owned', async () => {
            const queryRes = (await governor.query.owner()).value.ok!;
            expect(queryRes).to.be.equal(governor.address);
          });
        });
        describe('StakeStorage', () => {
          it('want', async () => {
            const queryRes = (await governor.query.want()).value.ok!;
            expect(queryRes).to.be.equal(govToken.address);
          });
          it('unstakePeriod', async () => {
            const queryRes = (await governor.query.unstakePeriod()).value.ok!;
            expect(queryRes).to.be.equal(21 * DAY);
          });
          it('maximalNumberOfUnstakes', async () => {
            const queryRes = (await governor.query.maximalNumberOfUnstakes()).value.ok!;
            expect(queryRes).to.be.equal(3);
          });
        });
        describe('GovernorStorage', () => {
          it('nextRuleId', async () => {
            const queryRes = (await governor.query.nextRuleId()).value.ok!;
            expect(queryRes).to.be.equal(1);
          });
          it('rules 0 allowe', async () => {
            const queryRes = (await governor.query.rulesAllowed(0)).value.ok!;
            expect(queryRes).to.be.equal(true);
          });
          it('rules', async () => {
            const queryRes = (await governor.query.rules(0)).value.ok! as any;
            queryRes.deposit = queryRes.deposit.rawNumber.toString();
            expect(queryRes).to.deep.equal({
              minimumStakePartE12: E12.divn(100).toNumber(),
              deposit: '0', // TODO E12.muln(1000).toString(),
              initialPeriod: 3 * DAY,
              flatPeriod: 7 * DAY,
              finalPeriod: 4 * DAY,
              maximalVoterRewardPartE12: E12.divn(20).toNumber(),
              proposerSlashPartE12: E12.divn(2).toNumber(),
              voterSlashPartE12: E12.divn(5).toNumber(),
            });
          });
        });
      });
    });
  });
});

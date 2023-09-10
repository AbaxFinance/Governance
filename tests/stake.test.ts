import { KeyringPair } from '@polkadot/keyring/types';
import BN from 'bn.js';
// import BlockTimestampProviderContract from '../typechain/contracts/block_timestamp_provider';
import Staker from '../typechain/contracts/staker';
import PSP22Mintable from 'typechain/contracts/psp22_mintable';
import BlockTimestsampProvider from 'typechain/contracts/block_timestamp_provider';
import { TestEnv, makeSuite } from './utlis/make-suite';
import { DAY, E12, E21, E6 } from 'scripts/types_and_consts';
// import { GovernErrorBuilder, PSP22ErrorBuilder, StakeErrorBuilder } from 'typechain/types-returns/governor';
import { stakeAndCheck } from './utlis/checkers/staker/stake';
import { PSP22ErrorBuilder, StakeErrorBuilder } from 'typechain/types-returns/staker';
import { initializeUnstakeAndCheck } from './utlis/checkers/staker/initializeUnstake';
import { unstakeAndCheck } from './utlis/checkers/staker/unstake';
import { rewardAndCheck } from './utlis/checkers/staker/reward';
import { slashAndCheck } from './utlis/checkers/staker/slash';
import { expect } from './setup/chai';
import { replaceRNPropsWithStrings } from './utlis/misc';

makeSuite('Stake tests', (getTestEnv) => {
  let testEnv: TestEnv;
  let deployer: KeyringPair;
  let users: KeyringPair[];
  let staker: Staker;
  let psp22Mintable: PSP22Mintable;
  let timestmpProvider: BlockTimestsampProvider;
  beforeEach(async () => {
    testEnv = getTestEnv();
    deployer = testEnv.deployer;
    users = testEnv.users;
    staker = testEnv.staker;
    psp22Mintable = testEnv.psp22Mintable;
    timestmpProvider = testEnv.timestampProvider;
  });
  describe(`Stake : user0 `, () => {
    it(`tries to stake 0`, async () => {
      await stakeAndCheck(testEnv, users[0], new BN(0), StakeErrorBuilder.AmountIsZero());
    });
    it(`tries to stake but hasn't given allowance`, async () => {
      await stakeAndCheck(testEnv, users[0], new BN(1), StakeErrorBuilder.PSP22Error(PSP22ErrorBuilder.InsufficientAllowance()));
    });
    describe(`gives allowance to the staker and ... `, () => {
      beforeEach(async () => {
        await psp22Mintable.withSigner(users[0]).tx.increaseAllowance(staker.address, E21);
      });
      it(`tries to stake but has no balance at all`, async () => {
        await stakeAndCheck(testEnv, users[0], new BN(1), StakeErrorBuilder.PSP22Error(PSP22ErrorBuilder.InsufficientBalance()));
      });
      describe(`receives E6*E12 tokens from deployer and ...`, () => {
        const userBalance = E6.mul(E12);
        beforeEach(async () => {
          await psp22Mintable.withSigner(deployer).tx.transfer(users[0].address, userBalance, []);
        });
        it(`tries to stake more than has`, async () => {
          await stakeAndCheck(testEnv, users[0], userBalance.addn(1), StakeErrorBuilder.PSP22Error(PSP22ErrorBuilder.InsufficientBalance()));
        });

        it(`stakes all successfully - event is emitted, state of the contract is updated`, async () => {
          console.log((await testEnv.timestampProvider.query.getBlockTimestamp()).value);
          console.log(await testEnv.timestampProvider.query.getShouldReturnMockValue());
          await stakeAndCheck(testEnv, users[0], userBalance, undefined);
        });

        it(`stakes all successfully in four transactions - event is emitted, state of the contract is updated`, async () => {
          const divBy = 4;
          await stakeAndCheck(testEnv, users[0], userBalance.divn(divBy), undefined);
          await stakeAndCheck(testEnv, users[0], userBalance.divn(divBy), undefined);
          await stakeAndCheck(testEnv, users[0], userBalance.divn(divBy), undefined);
          await stakeAndCheck(testEnv, users[0], userBalance.divn(divBy), undefined);
        });
      });
    });
  });

  describe(`Initialize Unstake : user0 `, () => {
    it(`tries to initialze unstake but hasn't any stake`, async () => {
      await initializeUnstakeAndCheck(testEnv, users[0], new BN(1), StakeErrorBuilder.InsufficientStake());
    });
    describe(`stakes E6*E12 tokens`, () => {
      const amountStaked = E6.mul(E12);
      beforeEach(async () => {
        await psp22Mintable.withSigner(users[0]).tx.increaseAllowance(staker.address, E21);
        await psp22Mintable.withSigner(deployer).tx.transfer(users[0].address, E6.mul(E12), []);
        await staker.withSigner(users[0]).tx.stake(amountStaked);
      });
      it(`tries to initialize unstake of 0 amount`, async () => {
        await initializeUnstakeAndCheck(testEnv, users[0], new BN(0), StakeErrorBuilder.AmountIsZero());
      });

      it(`tries to unstake more than has`, async () => {
        await initializeUnstakeAndCheck(testEnv, users[0], amountStaked.addn(1), StakeErrorBuilder.InsufficientStake());
      });

      it(`initialize unstake of all stake successfully - event is emitted, state of the contract is updated`, async () => {
        await initializeUnstakeAndCheck(testEnv, users[0], amountStaked, undefined);
      });
      it(`initialize unstake of 1/3 of stake 3 times successfully - event is emitted, state of the contract is updated`, async () => {
        const divBy = 3;
        await initializeUnstakeAndCheck(testEnv, users[0], amountStaked.divn(divBy), undefined);
        await initializeUnstakeAndCheck(testEnv, users[0], amountStaked.divn(divBy), undefined);
        await initializeUnstakeAndCheck(testEnv, users[0], amountStaked.divn(divBy), undefined);
      });
      it(`initialize unstake of 1/4 of stake 4 times fails because maximal number of initialized usntakes was reached`, async () => {
        const divBy = 4;
        await initializeUnstakeAndCheck(testEnv, users[0], amountStaked.divn(divBy), undefined);
        await initializeUnstakeAndCheck(testEnv, users[0], amountStaked.divn(divBy), undefined);
        await initializeUnstakeAndCheck(testEnv, users[0], amountStaked.divn(divBy), undefined);
        await initializeUnstakeAndCheck(testEnv, users[0], amountStaked.divn(divBy), StakeErrorBuilder.ToManyUnstakes());
      });

      it(`stakeAndUnstakesInitializedAfter test`, async () => {
        const divBy = 3;
        expect((await staker.query.stakeAndUnstakesInitializedAfter(users[0].address, 0)).value.ok?.rawNumber.toString()).to.be.equal(
          amountStaked.toString(),
        );
        await initializeUnstakeAndCheck(testEnv, users[0], amountStaked.divn(divBy), undefined);
        expect((await staker.query.stakeAndUnstakesInitializedAfter(users[0].address, 0)).value.ok?.rawNumber.toString()).to.be.equal(
          amountStaked.toString(),
        );
        await timestmpProvider.tx.increaseBlockTimestamp(10 * DAY);
        expect((await staker.query.stakeAndUnstakesInitializedAfter(users[0].address, 0)).value.ok?.rawNumber.toString()).to.be.equal(
          amountStaked.toString(),
        );
        await initializeUnstakeAndCheck(testEnv, users[0], amountStaked.divn(divBy), undefined);
        expect((await staker.query.stakeAndUnstakesInitializedAfter(users[0].address, 0)).value.ok?.rawNumber.toString()).to.be.equal(
          amountStaked.toString(),
        );
        await timestmpProvider.tx.increaseBlockTimestamp(10 * DAY);
        expect((await staker.query.stakeAndUnstakesInitializedAfter(users[0].address, 0)).value.ok?.rawNumber.toString()).to.be.equal(
          amountStaked.toString(),
        );
        await initializeUnstakeAndCheck(testEnv, users[0], amountStaked.divn(divBy), undefined);
        expect((await staker.query.stakeAndUnstakesInitializedAfter(users[0].address, 0)).value.ok?.rawNumber.toString()).to.be.equal(
          amountStaked.toString(),
        );
      });
    });
  });

  describe(`Unstake : user0 `, () => {
    it(`tries to unstake but hasn't done any action before`, async () => {
      await unstakeAndCheck(testEnv, users[0], StakeErrorBuilder.NoInitializedUnstakes());
    });
    describe(`stakes E6*E12 tokens`, () => {
      const amountStaked = E6.mul(E12).divn(2);
      beforeEach(async () => {
        await psp22Mintable.withSigner(users[0]).tx.increaseAllowance(staker.address, E21);
        await psp22Mintable.withSigner(deployer).tx.transfer(users[0].address, E6.mul(E12), []);
        await staker.withSigner(users[0]).tx.stake(amountStaked);
      });

      it(`tries to unstake but hasn't initialize unstake`, async () => {
        await unstakeAndCheck(testEnv, users[0], StakeErrorBuilder.NoInitializedUnstakes());
      });
      describe(`initializes unstake for all stake and then...`, () => {
        beforeEach(async () => {
          await staker.withSigner(users[0]).tx.initializeUnstake(amountStaked);
        });
        it(`tries to instantly unstake but no time has passed yet`, async () => {
          await unstakeAndCheck(testEnv, users[0], StakeErrorBuilder.TooEarly());
        });
        it(`tries to unstake after 21DAYS minus one second (untsake period is 21 DAYS)`, async () => {
          await timestmpProvider.tx.increaseBlockTimestamp(21 * DAY - 1);
          await unstakeAndCheck(testEnv, users[0], StakeErrorBuilder.TooEarly());
        });

        describe(`21 Days later`, () => {
          beforeEach(async () => {
            await timestmpProvider.tx.increaseBlockTimestamp(21 * DAY);
          });
          it(`unstakes successfully - event is emited, state of contract is updated`, async () => {
            await unstakeAndCheck(testEnv, users[0], undefined);
          });
        });
      });
      describe(`initializes unstake for half of stake twice, now and 1 DAY later, and then...`, () => {
        beforeEach(async () => {
          await staker.withSigner(users[0]).tx.initializeUnstake(amountStaked.divn(2));
          await timestmpProvider.tx.increaseBlockTimestamp(1 * DAY);
          await staker.withSigner(users[0]).tx.initializeUnstake(amountStaked.divn(2));
        });
        it(`tries to instantly unstake but no time has passed yet`, async () => {
          await unstakeAndCheck(testEnv, users[0], StakeErrorBuilder.TooEarly());
        });
        it(`tries to unstake after 21DAYS minus one second (untsake period is 21 DAYS)`, async () => {
          await timestmpProvider.tx.increaseBlockTimestamp(20 * DAY - 1);
          await unstakeAndCheck(testEnv, users[0], StakeErrorBuilder.TooEarly());
        });

        describe(`21 Days later`, () => {
          beforeEach(async () => {
            await timestmpProvider.tx.increaseBlockTimestamp(20 * DAY);
          });
          it(`unstakes successfully one of his unstakes - event is emited, state of contract is updated`, async () => {
            await unstakeAndCheck(testEnv, users[0], undefined);
            await unstakeAndCheck(testEnv, users[0], StakeErrorBuilder.TooEarly());
          });
          describe(`1 Day later`, () => {
            beforeEach(async () => {
              await timestmpProvider.tx.increaseBlockTimestamp(1 * DAY);
            });
            it(`unstakes successfully remaining one - event is emited, state of contract is updated`, async () => {
              await unstakeAndCheck(testEnv, users[0], undefined);
              await unstakeAndCheck(testEnv, users[0], StakeErrorBuilder.NoInitializedUnstakes());
            });
          });
        });

        describe(`22 Days later`, () => {
          beforeEach(async () => {
            await timestmpProvider.tx.increaseBlockTimestamp(21 * DAY);
          });
          it(`unstakes successfully two of his unstakes - event is emited, state of contract is updated`, async () => {
            await unstakeAndCheck(testEnv, users[0], undefined);
            await unstakeAndCheck(testEnv, users[0], StakeErrorBuilder.NoInitializedUnstakes());
          });
        });
      });
    });
  });

  describe(`Reward : user0 `, () => {
    it(`user tries to reward other user, for 0 amount `, async () => {
      await rewardAndCheck(testEnv, users[0], users[1], new BN(0), StakeErrorBuilder.AmountIsZero());
    });
    it(`user rewards himself, as there is no restiction on rewarding. Event is emitted and storege is updated `, async () => {
      await rewardAndCheck(testEnv, users[0], users[0], new BN(1000000), undefined);
    });
    it(`user rewards other user, as there is no restiction on rewarding. Event is emitted and storege is updated `, async () => {
      await rewardAndCheck(testEnv, users[0], users[1], new BN(1000000), undefined);
    });
  });

  describe(`Slash : user0 `, () => {
    it(`user tries to slash other user, for 0 amount  `, async () => {
      await slashAndCheck(testEnv, users[0], users[0], new BN(0), undefined, StakeErrorBuilder.AmountIsZero());
    });
    it(`user tries to slash himself, has nothing at stake  `, async () => {
      await slashAndCheck(testEnv, users[0], users[0], new BN(1000000), undefined, StakeErrorBuilder.StakeIsZero());
    });
    it(`user tries to slash other user who has nothing at stake`, async () => {
      await slashAndCheck(testEnv, users[0], users[1], new BN(1000000), undefined, StakeErrorBuilder.StakeIsZero());
    });
    describe(`stakes E6*E12 tokens`, () => {
      const amountStaked = E6.mul(E12).divn(2);
      beforeEach(async () => {
        await psp22Mintable.withSigner(users[0]).tx.increaseAllowance(staker.address, E21);
        await psp22Mintable.withSigner(deployer).tx.transfer(users[0].address, E6.mul(E12), []);
        await staker.withSigner(users[0]).tx.stake(amountStaked);
      });
      it(`someone slashes user, by part of his stake, event is emitted, storage is updated`, async () => {
        await slashAndCheck(testEnv, users[0], users[0], amountStaked.divn(2), amountStaked.divn(2), undefined);
      });
      it(`someone slashes user, by exactly his stake, event is emitted, storage is updated`, async () => {
        await slashAndCheck(testEnv, users[0], users[0], amountStaked, amountStaked, undefined);
      });
      it(`someone slashes user, by more then his stake, event is emitted, storage is updated`, async () => {
        await slashAndCheck(testEnv, users[0], users[0], amountStaked.muln(2), amountStaked, undefined);
      });
      describe(`user initializes 3 unstakes, each 1/4`, () => {
        beforeEach(async () => {
          await initializeUnstakeAndCheck(testEnv, users[0], amountStaked.divn(4), undefined);
          await initializeUnstakeAndCheck(testEnv, users[0], amountStaked.divn(4), undefined);
          await initializeUnstakeAndCheck(testEnv, users[0], amountStaked.divn(4), undefined);
        });
        it(`someone slashes user, by part of his stake and unstakes, event is emitted, storage is updated`, async () => {
          await slashAndCheck(testEnv, users[0], users[0], amountStaked.divn(2), amountStaked.divn(2), undefined);
        });
        it(`someone slashes user, by exactly his stake and unstakes, event is emitted, storage is updated`, async () => {
          await slashAndCheck(testEnv, users[0], users[0], amountStaked, amountStaked, undefined);
        });
        it(`someone slashes user, by more then his stake, event is emitted, storage is updated`, async () => {
          await slashAndCheck(testEnv, users[0], users[0], amountStaked.muln(2), amountStaked, undefined);
        });
      });
    });
  });
  describe('Change Unstake Period', () => {
    it('user0 changes unstake period', async () => {
      const tx = staker.tx.changeUnstakePeriod(10 * DAY);
      await expect(tx).to.be.eventually.fulfilled;
      const txRes = await tx;
      expect.soft((await staker.query.unstakePeriod()).value.ok).to.be.equal(10 * DAY);
      expect.soft(replaceRNPropsWithStrings(txRes.events)).to.deep.equal([
        {
          name: 'UnstakePeriodChanged',
          args: {
            unstakePeriod: 10 * DAY,
          },
        },
      ]);
      expect.flushSoft();
    });
  });

  describe('Change Maximal Number Of Unstakes', () => {
    it('user0 changes maximal number of unstakes', async () => {
      const tx = staker.tx.changeMaximalNumberOfUnstakes(5);
      await expect(tx).to.be.eventually.fulfilled;
      const txRes = await tx;
      expect.soft((await staker.query.maximalNumberOfUnstakes()).value.ok).to.be.equal(5);
      expect.soft(replaceRNPropsWithStrings(txRes.events)).to.deep.equal([
        {
          name: 'MaximalNumberOfUnstakesChanged',
          args: {
            maximalNumberOfUnstakes: 5,
          },
        },
      ]);
      expect.flushSoft();
    });
  });
});

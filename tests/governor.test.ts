import { KeyringPair } from '@polkadot/keyring/types';
import BN from 'bn.js';
// import BlockTimestampProviderContract from '../typechain/contracts/block_timestamp_provider';
import { DAY, E12, E21, E6 } from 'scripts/types_and_consts';
import BlockTimestsampProvider from 'typechain/contracts/block_timestamp_provider';
import GovernanceToken from 'typechain/contracts/governance_token';
import Governor from '../typechain/contracts/governor';
import { TestEnv, makeSuite } from './utlis/make-suite';
// import { GovernErrorBuilder, PSP22ErrorBuilder, StakeErrorBuilder } from 'typechain/types-returns/governor';
import { Proposal, Vote } from 'typechain/types-arguments/governor';
import { GovernErrorBuilder, ProposalStatus } from 'typechain/types-returns/governor';
import { apiProviderWrapper } from './setup/helpers';
import { claimRewardAndCheck } from './utlis/checkers/governor/claimReward';
import { executeAndCheck } from './utlis/checkers/governor/execute';
import { finalizeAndCheck } from './utlis/checkers/governor/finalize';
import { proposeAndCheck } from './utlis/checkers/governor/propose';
import { slashVoterAndCheck } from './utlis/checkers/governor/slashVoter';
import { voteAndCheck } from './utlis/checkers/governor/vote';
import { hexToNumbers } from './utlis/converters/hex-number';
import { replaceRNPropsWithStrings, toE12 } from './utlis/misc';

import type { WeightV2 } from '@polkadot/types/interfaces';
import { expect } from './setup/chai';

makeSuite('Governor tests', (getTestEnv) => {
  let testEnv: TestEnv;
  let deployer: KeyringPair;
  let users: KeyringPair[];
  let governor: Governor;
  let govToken: GovernanceToken;
  let timestmpProvider: BlockTimestsampProvider;

  const encoder = new TextEncoder();

  const bigStake = E6.mul(E12).muln(10);
  const midStake = E6.mul(E12);
  const smallStake = E6.mul(E12).divn(10);

  beforeEach(async () => {
    testEnv = getTestEnv();
    deployer = testEnv.deployer;
    users = testEnv.users;
    governor = testEnv.governor;
    govToken = testEnv.govToken;
    timestmpProvider = testEnv.timestampProvider;

    await govToken.withSigner(deployer).tx.transfer(users[0].address, bigStake, []);
    await govToken.withSigner(deployer).tx.transfer(users[1].address, bigStake, []);
    await govToken.withSigner(deployer).tx.transfer(users[2].address, midStake, []);
    await govToken.withSigner(deployer).tx.transfer(users[3].address, midStake, []);
    await govToken.withSigner(deployer).tx.transfer(users[4].address, smallStake, []);
    await govToken.withSigner(deployer).tx.transfer(users[5].address, smallStake, []);
    await govToken.withSigner(deployer).tx.transfer(users[6].address, smallStake, []);

    await govToken.withSigner(users[0]).tx.increaseAllowance(governor.address, E21);
    await govToken.withSigner(users[1]).tx.increaseAllowance(governor.address, E21);
    await govToken.withSigner(users[2]).tx.increaseAllowance(governor.address, E21);
    await govToken.withSigner(users[3]).tx.increaseAllowance(governor.address, E21);
    await govToken.withSigner(users[4]).tx.increaseAllowance(governor.address, E21);
    await govToken.withSigner(users[5]).tx.increaseAllowance(governor.address, E21);
    await govToken.withSigner(users[6]).tx.increaseAllowance(governor.address, E21);

    await governor.withSigner(users[0]).tx.stake(bigStake);
    await governor.withSigner(users[1]).tx.stake(bigStake);
    await governor.withSigner(users[2]).tx.stake(midStake);
    await governor.withSigner(users[3]).tx.stake(midStake);
    await governor.withSigner(users[4]).tx.stake(smallStake);
    await governor.withSigner(users[5]).tx.stake(smallStake);
  });
  describe(' There is 6 stakers (user0,...,user5), with stake proportions 100,100,10,10,1,1', () => {
    describe('Proposing:', () => {
      it('uesr0 trying to use not allowed rule', async () => {
        const description = 'Abax will be the best ;-)';
        const proposal: Proposal = {
          rulesId: 1,
          voterRewardPartE12: 0,
          transactions: [],
        };
        await proposeAndCheck(testEnv, users[0], proposal, description, GovernErrorBuilder.RuleNotAllowed());
      });
      // TODO deposit was set to 0 as I typechain doesnt support contract tx with value....
      // it('user0 trying propose with no deposit', async () => {
      //   const description = [0, 1, 2];
      //   const proposal: Proposal = {
      //     rulesId: 0,
      //     voterRewardPartE12: 0,
      //     transactions: [],
      //   };
      //   await proposeAndCheck(testEnv, users[0], proposal, description, GovernErrorBuilder.PropositionDeposit());
      // });

      it('user4 trying to propose with insufficient Votes', async () => {
        const description = 'Abax will be the best ;-)';
        const proposal: Proposal = {
          rulesId: 0,
          voterRewardPartE12: toE12(0.051),
          transactions: [],
        };
        await proposeAndCheck(testEnv, users[4], proposal, description, GovernErrorBuilder.InnsuficientVotes());
      });

      it('user2 trying to set to high RewardMultiplier', async () => {
        const description = 'Abax will be the best ;-)';
        const proposal: Proposal = {
          rulesId: 0,
          voterRewardPartE12: toE12(0.051),
          transactions: [],
        };
        await proposeAndCheck(testEnv, users[2], proposal, description, GovernErrorBuilder.RewardMultiplier());
      });
      it('user2 trying to set to high RewardMultiplier for him', async () => {
        const description = 'Abax will be the best ;-)';
        const proposal: Proposal = {
          rulesId: 0,
          voterRewardPartE12: toE12(0.05),
          transactions: [],
        };
        await proposeAndCheck(testEnv, users[2], proposal, description, GovernErrorBuilder.RewardMultiplier());
      });
      it('user0 successfully creates proposal', async () => {
        const description = 'Abax will be the best ;-)';
        const proposal: Proposal = {
          rulesId: 0,
          voterRewardPartE12: toE12(0.05),
          transactions: [],
        };
        await proposeAndCheck(testEnv, users[0], proposal, description, undefined);
      });

      it('user0 tires to create proposal twice', async () => {
        const description = 'Abax will be the best ;-)';
        const proposal: Proposal = {
          rulesId: 0,
          voterRewardPartE12: toE12(0.05),
          transactions: [],
        };
        await proposeAndCheck(testEnv, users[0], proposal, description, undefined);
        await proposeAndCheck(testEnv, users[0], proposal, description, GovernErrorBuilder.ProposalAlreadyExists());
      });

      it('user1 tires to create proposal after user 0 already created it', async () => {
        const description = 'Abax will be the best ;-)';
        const proposal: Proposal = {
          rulesId: 0,
          voterRewardPartE12: toE12(0.05),
          transactions: [],
        };
        await proposeAndCheck(testEnv, users[0], proposal, description, undefined);
        await proposeAndCheck(testEnv, users[1], proposal, description, GovernErrorBuilder.ProposalAlreadyExists());
      });
    });
    describe('Voting', () => {
      const description = 'Abax will be the best ;-)';
      const proposal: Proposal = {
        rulesId: 0,
        voterRewardPartE12: 0,
        transactions: [],
      };
      const proposal2: Proposal = {
        rulesId: 1,
        voterRewardPartE12: 11,
        transactions: [],
      };
      let proposalId: number[];
      let proposalId2: number[];
      beforeEach(async () => {
        proposalId = hexToNumbers(((await testEnv.hasher.query.hashProposalWithDescription(proposal, description)).value.ok! as string).substring(2));
        proposalId2 = hexToNumbers(
          ((await testEnv.hasher.query.hashProposalWithDescription(proposal2, description)).value.ok! as string).substring(2),
        );
        await proposeAndCheck(testEnv, users[0], proposal, description, undefined);
      });
      it('user6 with no stake tries to vote', async () => {
        await voteAndCheck(testEnv, users[6], proposalId, Vote.agreed, GovernErrorBuilder.ZeroVotes());
      });
      it('user0 tries to vote for not existing proposal', async () => {
        await voteAndCheck(testEnv, users[0], proposalId2, Vote.agreed, GovernErrorBuilder.ProposalDoesntExist());
      });
      it('user0 tries to vote after prposal is finalized ', async () => {
        await testEnv.timestampProvider.tx.increaseBlockTimestamp(22 * DAY);
        await governor.tx.finalize(proposalId);
        await voteAndCheck(testEnv, users[0], proposalId, Vote.agreed, GovernErrorBuilder.NotActive());
      });
      it('many users can vote for different', async () => {
        await voteAndCheck(testEnv, users[0], proposalId, Vote.agreed);
        await voteAndCheck(testEnv, users[1], proposalId, Vote.disagreedWithProposerSlashing);
        await voteAndCheck(testEnv, users[2], proposalId, Vote.disagreed);
        await voteAndCheck(testEnv, users[3], proposalId, Vote.disagreed);
        await voteAndCheck(testEnv, users[4], proposalId, Vote.disagreedWithProposerSlashing);
      });
    });
    describe('Finalize', () => {
      const description = 'Abax will be the best ;-)';
      const proposal: Proposal = {
        rulesId: 0,
        voterRewardPartE12: 0,
        transactions: [],
      };
      const proposal2: Proposal = {
        rulesId: 1,
        voterRewardPartE12: 11,
        transactions: [],
      };
      let proposalId: number[];
      let proposalId2: number[];
      beforeEach(async () => {
        proposalId = hexToNumbers(((await testEnv.hasher.query.hashProposalWithDescription(proposal, description)).value.ok! as string).substring(2));
        proposalId2 = hexToNumbers(
          ((await testEnv.hasher.query.hashProposalWithDescription(proposal2, description)).value.ok! as string).substring(2),
        );
        await proposeAndCheck(testEnv, users[0], proposal, description, undefined);
      });
      it('user tries to finalize proposal that doesnt exist', async () => {
        await finalizeAndCheck(testEnv, users[6], proposalId2, undefined, GovernErrorBuilder.ProposalDoesntExist());
      });
      it('user tries to finalize proposal that doesnt meet finalization condition', async () => {
        await finalizeAndCheck(testEnv, users[6], proposalId, undefined, GovernErrorBuilder.FinalizeCondition());
      });
      describe(`all stakers votes for 'agree`, () => {
        beforeEach(async () => {
          await voteAndCheck(testEnv, users[0], proposalId, Vote.agreed);
          await voteAndCheck(testEnv, users[1], proposalId, Vote.agreed);
          await voteAndCheck(testEnv, users[2], proposalId, Vote.agreed);
          await voteAndCheck(testEnv, users[3], proposalId, Vote.agreed);
          await voteAndCheck(testEnv, users[4], proposalId, Vote.agreed);
          await voteAndCheck(testEnv, users[5], proposalId, Vote.agreed);
        });
        it('user finalize succesfully', async () => {
          await finalizeAndCheck(testEnv, users[0], proposalId, ProposalStatus.succeeded);
        });
      });
      describe(`all stakers votes for 'disagree`, () => {
        beforeEach(async () => {
          await voteAndCheck(testEnv, users[0], proposalId, Vote.disagreed);
          await voteAndCheck(testEnv, users[1], proposalId, Vote.disagreed);
          await voteAndCheck(testEnv, users[2], proposalId, Vote.disagreed);
          await voteAndCheck(testEnv, users[3], proposalId, Vote.disagreed);
          await voteAndCheck(testEnv, users[4], proposalId, Vote.disagreed);
          await voteAndCheck(testEnv, users[5], proposalId, Vote.disagreed);
        });
        it('user finalize succesfully', async () => {
          await finalizeAndCheck(testEnv, users[0], proposalId, ProposalStatus.defeated);
        });
      });
      describe(`all stakers votes for 'disagreedWithProposerSlashing`, () => {
        beforeEach(async () => {
          await voteAndCheck(testEnv, users[0], proposalId, Vote.disagreedWithProposerSlashing);
          await voteAndCheck(testEnv, users[1], proposalId, Vote.disagreedWithProposerSlashing);
          await voteAndCheck(testEnv, users[2], proposalId, Vote.disagreedWithProposerSlashing);
          await voteAndCheck(testEnv, users[3], proposalId, Vote.disagreedWithProposerSlashing);
          await voteAndCheck(testEnv, users[4], proposalId, Vote.disagreedWithProposerSlashing);
          await voteAndCheck(testEnv, users[5], proposalId, Vote.disagreedWithProposerSlashing);
        });
        it('user finalize succesfully', async () => {
          await finalizeAndCheck(testEnv, users[0], proposalId, ProposalStatus.defeatedWithSlash);
        });
      });
      describe(`all stakers votes for disagree or disagreedWithProposerSlashing, but most for disagreed`, () => {
        beforeEach(async () => {
          await voteAndCheck(testEnv, users[0], proposalId, Vote.disagreed);
          await voteAndCheck(testEnv, users[1], proposalId, Vote.disagreedWithProposerSlashing);
          await voteAndCheck(testEnv, users[2], proposalId, Vote.disagreed);
          await voteAndCheck(testEnv, users[3], proposalId, Vote.disagreedWithProposerSlashing);
          await voteAndCheck(testEnv, users[4], proposalId, Vote.disagreed);
          await voteAndCheck(testEnv, users[5], proposalId, Vote.disagreed);
        });
        it('user finalize succesfully', async () => {
          await finalizeAndCheck(testEnv, users[0], proposalId, ProposalStatus.defeated);
        });
      });
      describe(`all stakers votes for disagree or disagreedWithProposerSlashing, but most for disagreedWithProposerSlashing`, () => {
        beforeEach(async () => {
          await voteAndCheck(testEnv, users[0], proposalId, Vote.disagreed);
          await voteAndCheck(testEnv, users[1], proposalId, Vote.disagreedWithProposerSlashing);
          await voteAndCheck(testEnv, users[2], proposalId, Vote.disagreed);
          await voteAndCheck(testEnv, users[3], proposalId, Vote.disagreedWithProposerSlashing);
          await voteAndCheck(testEnv, users[4], proposalId, Vote.disagreedWithProposerSlashing);
          await voteAndCheck(testEnv, users[5], proposalId, Vote.disagreedWithProposerSlashing);
        });
        it('user finalize succesfully', async () => {
          await finalizeAndCheck(testEnv, users[0], proposalId, ProposalStatus.defeatedWithSlash);
        });
      });
      describe(`more than 50% votes for agree, rest disagree`, () => {
        beforeEach(async () => {
          await voteAndCheck(testEnv, users[0], proposalId, Vote.agreed);
          await voteAndCheck(testEnv, users[1], proposalId, Vote.disagreed);
          await voteAndCheck(testEnv, users[2], proposalId, Vote.agreed);
          await voteAndCheck(testEnv, users[3], proposalId, Vote.disagreed);
          await voteAndCheck(testEnv, users[4], proposalId, Vote.agreed);
          await voteAndCheck(testEnv, users[5], proposalId, Vote.agreed);
        });
        it('user tries to finalize that doesnt meet finalization condition', async () => {
          await finalizeAndCheck(testEnv, users[0], proposalId, undefined, GovernErrorBuilder.FinalizeCondition());
        });
        describe(`then 3 days passes`, () => {
          beforeEach(async () => {
            await timestmpProvider.tx.increaseBlockTimestamp(3 * DAY);
          });
          it('user finalize succesfully as linear 50% is reached', async () => {
            await finalizeAndCheck(testEnv, users[0], proposalId, ProposalStatus.succeeded);
          });
        });
      });
      describe(`more than 50% votes for disagree(most) or disagreedWithProposerSlashing, rest agree`, () => {
        beforeEach(async () => {
          await voteAndCheck(testEnv, users[0], proposalId, Vote.agreed);
          await voteAndCheck(testEnv, users[1], proposalId, Vote.disagreed);
          await voteAndCheck(testEnv, users[2], proposalId, Vote.agreed);
          await voteAndCheck(testEnv, users[3], proposalId, Vote.disagreedWithProposerSlashing);
          await voteAndCheck(testEnv, users[4], proposalId, Vote.disagreed);
          await voteAndCheck(testEnv, users[5], proposalId, Vote.disagreed);
        });
        it('user tries to finalize that doesnt meet finalization condition', async () => {
          await finalizeAndCheck(testEnv, users[0], proposalId, undefined, GovernErrorBuilder.FinalizeCondition());
        });
        describe(`then 3 days passes`, () => {
          beforeEach(async () => {
            await timestmpProvider.tx.increaseBlockTimestamp(3 * DAY);
          });
          it('user finalize succesfully as linear 50% is reached', async () => {
            await finalizeAndCheck(testEnv, users[0], proposalId, ProposalStatus.defeated);
          });
        });
      });
      describe(`more than 50% votes for disagreedWithProposerSlashing, rest disagree`, () => {
        beforeEach(async () => {
          await voteAndCheck(testEnv, users[0], proposalId, Vote.agreed);
          await voteAndCheck(testEnv, users[1], proposalId, Vote.disagreedWithProposerSlashing);
          await voteAndCheck(testEnv, users[2], proposalId, Vote.agreed);
          await voteAndCheck(testEnv, users[3], proposalId, Vote.disagreedWithProposerSlashing);
          await voteAndCheck(testEnv, users[4], proposalId, Vote.disagreedWithProposerSlashing);
          await voteAndCheck(testEnv, users[5], proposalId, Vote.disagreedWithProposerSlashing);
        });
        it('user tries to finalize that doesnt meet finalization condition', async () => {
          await finalizeAndCheck(testEnv, users[0], proposalId, undefined, GovernErrorBuilder.FinalizeCondition());
        });
        describe(`then 3 days passes`, () => {
          beforeEach(async () => {
            await timestmpProvider.tx.increaseBlockTimestamp(3 * DAY);
          });
          it('user finalize succesfully as linear 50% is reached', async () => {
            await finalizeAndCheck(testEnv, users[0], proposalId, ProposalStatus.defeatedWithSlash);
          });
        });
      });
      describe(`only small % votes for agree, rest didnt vote`, () => {
        beforeEach(async () => {
          await voteAndCheck(testEnv, users[5], proposalId, Vote.agreed);
        });
        it('user tries to finalize that doesnt meet finalization condition', async () => {
          await finalizeAndCheck(testEnv, users[0], proposalId, undefined, GovernErrorBuilder.FinalizeCondition());
        });
        describe(`then 3 days passes`, () => {
          beforeEach(async () => {
            await timestmpProvider.tx.increaseBlockTimestamp(3 * DAY);
          });
          it('user tries to finalize that doesnt meet finalization condition', async () => {
            await finalizeAndCheck(testEnv, users[0], proposalId, undefined, GovernErrorBuilder.FinalizeCondition());
          });
          describe(`then 7 days passes`, () => {
            beforeEach(async () => {
              await timestmpProvider.tx.increaseBlockTimestamp(7 * DAY);
            });
            it('user tries to finalize that doesnt meet finalization condition', async () => {
              await finalizeAndCheck(testEnv, users[0], proposalId, undefined, GovernErrorBuilder.FinalizeCondition());
            });
            describe(`then 4 days minus 1 second passes`, () => {
              beforeEach(async () => {
                await timestmpProvider.tx.increaseBlockTimestamp(4 * DAY - 1);
              });
              it('user finalize succesfully as in final period treshold goes to 0 is reached', async () => {
                await finalizeAndCheck(testEnv, users[0], proposalId, ProposalStatus.succeeded);
              });
            });
          });
        });
      });
      describe(`only small % votes for disagreed, rest didnt vote`, () => {
        beforeEach(async () => {
          await voteAndCheck(testEnv, users[5], proposalId, Vote.disagreed);
        });
        it('user tries to finalize that doesnt meet finalization condition', async () => {
          await finalizeAndCheck(testEnv, users[0], proposalId, undefined, GovernErrorBuilder.FinalizeCondition());
        });
        describe(`then 3 days passes`, () => {
          beforeEach(async () => {
            await timestmpProvider.tx.increaseBlockTimestamp(3 * DAY);
          });
          it('user tries to finalize that doesnt meet finalization condition', async () => {
            await finalizeAndCheck(testEnv, users[0], proposalId, undefined, GovernErrorBuilder.FinalizeCondition());
          });
          describe(`then 7 days passes`, () => {
            beforeEach(async () => {
              await timestmpProvider.tx.increaseBlockTimestamp(7 * DAY);
            });
            it('user tries to finalize that doesnt meet finalization condition', async () => {
              await finalizeAndCheck(testEnv, users[0], proposalId, undefined, GovernErrorBuilder.FinalizeCondition());
            });
            describe(`then 4 days minus 1 second passes`, () => {
              beforeEach(async () => {
                await timestmpProvider.tx.increaseBlockTimestamp(4 * DAY - 1);
              });
              it('user finalize succesfully as in final period treshold goes to 0 is reached', async () => {
                await finalizeAndCheck(testEnv, users[0], proposalId, ProposalStatus.defeated);
              });
            });
          });
        });
      });
      describe(`only small % votes for disagreedWithProposerSlashing, rest didnt vote`, () => {
        beforeEach(async () => {
          await voteAndCheck(testEnv, users[5], proposalId, Vote.disagreedWithProposerSlashing);
        });
        it('user tries to finalize that doesnt meet finalization condition', async () => {
          await finalizeAndCheck(testEnv, users[0], proposalId, undefined, GovernErrorBuilder.FinalizeCondition());
        });
        describe(`then 3 days passes`, () => {
          beforeEach(async () => {
            await timestmpProvider.tx.increaseBlockTimestamp(3 * DAY);
          });
          it('user tries to finalize that doesnt meet finalization condition', async () => {
            await finalizeAndCheck(testEnv, users[0], proposalId, undefined, GovernErrorBuilder.FinalizeCondition());
          });
          describe(`then 7 days passes`, () => {
            beforeEach(async () => {
              await timestmpProvider.tx.increaseBlockTimestamp(7 * DAY);
            });
            it('user tries to finalize that doesnt meet finalization condition', async () => {
              await finalizeAndCheck(testEnv, users[0], proposalId, undefined, GovernErrorBuilder.FinalizeCondition());
            });
            describe(`then 4 days minus 1 second passes`, () => {
              beforeEach(async () => {
                await timestmpProvider.tx.increaseBlockTimestamp(4 * DAY - 1);
              });
              it('user finalize succesfully as in final period treshold goes to 0 is reached', async () => {
                await finalizeAndCheck(testEnv, users[0], proposalId, ProposalStatus.defeatedWithSlash);
              });
            });
          });
        });
      });
      describe(`no one has voted`, () => {
        it('user tries to finalize that doesnt meet finalization condition', async () => {
          await finalizeAndCheck(testEnv, users[0], proposalId, undefined, GovernErrorBuilder.FinalizeCondition());
        });
        describe(`then 3 days passes`, () => {
          beforeEach(async () => {
            await timestmpProvider.tx.increaseBlockTimestamp(3 * DAY);
          });
          it('user tries to finalize that doesnt meet finalization condition', async () => {
            await finalizeAndCheck(testEnv, users[0], proposalId, undefined, GovernErrorBuilder.FinalizeCondition());
          });
          describe(`then 7 days passes`, () => {
            beforeEach(async () => {
              await timestmpProvider.tx.increaseBlockTimestamp(7 * DAY);
            });
            it('user tries to finalize that doesnt meet finalization condition', async () => {
              await finalizeAndCheck(testEnv, users[0], proposalId, undefined, GovernErrorBuilder.FinalizeCondition());
            });
            describe(`then 4 days minus 1 second passes`, () => {
              beforeEach(async () => {
                await timestmpProvider.tx.increaseBlockTimestamp(4 * DAY - 1);
              });
              it('user tries to finalize that doesnt meet finalization condition', async () => {
                await finalizeAndCheck(testEnv, users[0], proposalId, undefined, GovernErrorBuilder.FinalizeCondition());
              });
              describe(`then 2 second passes`, () => {
                beforeEach(async () => {
                  await timestmpProvider.tx.increaseBlockTimestamp(2);
                });
                it('user tries to finalize that doesnt meet finalization condition', async () => {
                  await finalizeAndCheck(testEnv, users[0], proposalId, ProposalStatus.defeated);
                });
              });
            });
          });
        });
      });
    });
    describe('SlashVoter', () => {
      const description = 'Abax will be the best ;-)';
      const proposal: Proposal = {
        rulesId: 0,
        voterRewardPartE12: toE12(0.001),
        transactions: [],
      };
      const proposal2: Proposal = {
        rulesId: 1,
        voterRewardPartE12: 11,
        transactions: [],
      };
      let proposalId: number[];
      let proposalId2: number[];
      beforeEach(async () => {
        proposalId = hexToNumbers(((await testEnv.hasher.query.hashProposalWithDescription(proposal, description)).value.ok! as string).substring(2));
        proposalId2 = hexToNumbers(
          ((await testEnv.hasher.query.hashProposalWithDescription(proposal2, description)).value.ok! as string).substring(2),
        );
        await proposeAndCheck(testEnv, users[0], proposal, description, undefined);
      });
      it('user0 tries to slash user 1 for non-existing proposal', async () => {
        await slashVoterAndCheck(testEnv, users[0], users[1].address, proposalId2, GovernErrorBuilder.ProposalDoesntExist());
      });
      it('user0 tries to slash user 1 for active proposal', async () => {
        await slashVoterAndCheck(testEnv, users[0], users[1].address, proposalId, GovernErrorBuilder.StillActive());
      });
      describe(`proposal is finalized in flat period`, () => {
        beforeEach(async () => {
          await governor.withSigner(users[0]).tx.vote(proposalId, Vote.agreed, []);
          await governor.withSigner(users[2]).tx.vote(proposalId, Vote.agreed, []);
          await governor.withSigner(users[3]).tx.vote(proposalId, Vote.agreed, []);

          await timestmpProvider.tx.increaseBlockTimestamp(9 * DAY);
          await governor.tx.finalize(proposalId);
        });
        it(` so there is nothing to slash`, async () => {
          await slashVoterAndCheck(testEnv, users[0], users[1].address, proposalId, GovernErrorBuilder.NothingToSlash());
        });
      });
      describe(`proposal is finalized in final period`, () => {
        beforeEach(async () => {
          await governor.withSigner(users[0]).tx.vote(proposalId, Vote.agreed, []);

          await timestmpProvider.tx.increaseBlockTimestamp(12 * DAY);
          await governor.tx.finalize(proposalId);
        });
        it(`someone tries to shals user0 ho has voted`, async () => {
          await slashVoterAndCheck(testEnv, users[0], users[0].address, proposalId, GovernErrorBuilder.Voted());
        });
        it(`users who didnt vote are succesfully slashed`, async () => {
          await slashVoterAndCheck(testEnv, users[0], users[1].address, proposalId);
          await slashVoterAndCheck(testEnv, users[0], users[2].address, proposalId);
          await slashVoterAndCheck(testEnv, users[0], users[3].address, proposalId);
          await slashVoterAndCheck(testEnv, users[0], users[4].address, proposalId);
          await slashVoterAndCheck(testEnv, users[0], users[5].address, proposalId);
        });
        it(`user can not be slashed twice`, async () => {
          await slashVoterAndCheck(testEnv, users[0], users[1].address, proposalId);
          await slashVoterAndCheck(testEnv, users[0], users[1].address, proposalId, GovernErrorBuilder.AlreadyClaimedOrSlashed());
        });
      });
      describe(`proposal is finalized in final period and user6 has staken 0.5 DAY before finalization and hasnt voted `, () => {
        beforeEach(async () => {
          await governor.withSigner(users[0]).tx.vote(proposalId, Vote.agreed, []);

          await timestmpProvider.tx.increaseBlockTimestamp(12 * DAY);
          await governor.withSigner(users[6]).tx.stake(smallStake);
          await timestmpProvider.tx.increaseBlockTimestamp(DAY / 2);
          await governor.tx.finalize(proposalId);
        });
        it(`someone tries to slash user6 who can't be slashed`, async () => {
          await slashVoterAndCheck(testEnv, users[0], users[6].address, proposalId, GovernErrorBuilder.NothingToSlash());
        });
      });
      describe(`proposal is finalized in final period and user6 has staken 0.5 DAY after finalization and hasnt voted `, () => {
        beforeEach(async () => {
          await governor.withSigner(users[0]).tx.vote(proposalId, Vote.agreed, []);

          await timestmpProvider.tx.increaseBlockTimestamp(12 * DAY);
          await governor.tx.finalize(proposalId);
          await timestmpProvider.tx.increaseBlockTimestamp(DAY / 2);
          await governor.withSigner(users[6]).tx.stake(smallStake);
        });
        it(`someone tries to slash user6 who can't be slashed`, async () => {
          await slashVoterAndCheck(testEnv, users[0], users[6].address, proposalId, GovernErrorBuilder.NothingToSlash());
        });
      });
    });
    describe('ClaimReward', () => {
      const description = 'Abax will be the best ;-)';
      const proposal: Proposal = {
        rulesId: 0,
        voterRewardPartE12: toE12(0.001),
        transactions: [],
      };
      const proposal2: Proposal = {
        rulesId: 1,
        voterRewardPartE12: 11,
        transactions: [],
      };
      let proposalId: number[];
      let proposalId2: number[];
      beforeEach(async () => {
        proposalId = hexToNumbers(((await testEnv.hasher.query.hashProposalWithDescription(proposal, description)).value.ok! as string).substring(2));
        proposalId2 = hexToNumbers(
          ((await testEnv.hasher.query.hashProposalWithDescription(proposal2, description)).value.ok! as string).substring(2),
        );
        await proposeAndCheck(testEnv, users[0], proposal, description, undefined);
      });
      it('user0 tries to claim non-existing proposal', async () => {
        await claimRewardAndCheck(testEnv, users[0], proposalId2, GovernErrorBuilder.ProposalDoesntExist());
      });
      it('user0 tries to claim active proposal', async () => {
        await claimRewardAndCheck(testEnv, users[0], proposalId, GovernErrorBuilder.StillActive());
      });
      describe(`proposal is finalized`, () => {
        beforeEach(async () => {
          await governor.withSigner(users[0]).tx.vote(proposalId, Vote.agreed, []);
          await governor.withSigner(users[2]).tx.vote(proposalId, Vote.agreed, []);
          await governor.withSigner(users[3]).tx.vote(proposalId, Vote.agreed, []);

          await timestmpProvider.tx.increaseBlockTimestamp(9 * DAY);
          await governor.tx.finalize(proposalId);
        });
        it(` user who didn't vote treis to claim`, async () => {
          await claimRewardAndCheck(testEnv, users[1], proposalId, GovernErrorBuilder.DidntVote());
        });
        it(`users who did vote claims succesfully`, async () => {
          await claimRewardAndCheck(testEnv, users[0], proposalId);
          await claimRewardAndCheck(testEnv, users[2], proposalId);
          await claimRewardAndCheck(testEnv, users[3], proposalId);
        });
      });
    });
    describe('Execute', () => {
      const description = 'Abax will be the best ;-)';
      const proposal: Proposal = {
        rulesId: 0,
        voterRewardPartE12: toE12(0.001),
        transactions: [],
      };
      const proposal2: Proposal = {
        rulesId: 1,
        voterRewardPartE12: 11,
        transactions: [],
      };
      let proposalId: number[];
      let proposalId2: number[];
      let descriptionHash: number[];
      beforeEach(async () => {
        proposalId = hexToNumbers(((await testEnv.hasher.query.hashProposalWithDescription(proposal, description)).value.ok! as string).substring(2));
        proposalId2 = hexToNumbers(
          ((await testEnv.hasher.query.hashProposalWithDescription(proposal2, description)).value.ok! as string).substring(2),
        );
        descriptionHash = (await testEnv.hasher.query.hashDescription(description)).value.ok!;
        await proposeAndCheck(testEnv, users[0], proposal, description, undefined);
      });
      it('user0 tries to execute non-existing proposal', async () => {
        await executeAndCheck(testEnv, users[0], proposal2, descriptionHash, description, GovernErrorBuilder.ProposalDoesntExist());
      });
      it('user0 tries to execute active proposal', async () => {
        await executeAndCheck(testEnv, users[0], proposal, descriptionHash, description, GovernErrorBuilder.WrongStatus());
      });
      describe(`proposal is finalized with defeated`, () => {
        beforeEach(async () => {
          await governor.withSigner(users[0]).tx.vote(proposalId, Vote.disagreed, []);
          await governor.withSigner(users[2]).tx.vote(proposalId, Vote.disagreed, []);
          await governor.withSigner(users[3]).tx.vote(proposalId, Vote.disagreed, []);

          await timestmpProvider.tx.increaseBlockTimestamp(9 * DAY);
          await governor.tx.finalize(proposalId);
        });
        it('user0 tries to execute defeated proposal', async () => {
          await executeAndCheck(testEnv, users[0], proposal, descriptionHash, description, GovernErrorBuilder.WrongStatus());
        });
      });
      describe(`proposal is finalized with defeatedWithSlash`, () => {
        beforeEach(async () => {
          await governor.withSigner(users[0]).tx.vote(proposalId, Vote.disagreedWithProposerSlashing, []);
          await governor.withSigner(users[2]).tx.vote(proposalId, Vote.disagreedWithProposerSlashing, []);
          await governor.withSigner(users[3]).tx.vote(proposalId, Vote.disagreedWithProposerSlashing, []);

          await timestmpProvider.tx.increaseBlockTimestamp(9 * DAY);
          await governor.tx.finalize(proposalId);
        });
        it('user0 tries to execute defeatedWithSlash proposal', async () => {
          await executeAndCheck(testEnv, users[0], proposal, descriptionHash, description, GovernErrorBuilder.WrongStatus());
        });
      });
      describe(`proposal is finalized with Succeeded`, () => {
        beforeEach(async () => {
          await governor.withSigner(users[0]).tx.vote(proposalId, Vote.agreed, []);
          await governor.withSigner(users[2]).tx.vote(proposalId, Vote.agreed, []);
          await governor.withSigner(users[3]).tx.vote(proposalId, Vote.agreed, []);

          await timestmpProvider.tx.increaseBlockTimestamp(9 * DAY);
          await governor.tx.finalize(proposalId);
        });
        it('user0 executes Succeded proposal with no Tx', async () => {
          await executeAndCheck(testEnv, users[0], proposal, descriptionHash, description);
        });
      });
    });
    describe('Execute Proposal with transactions', () => {
      const description = 'Abax will be the best ;-)';
      let proposal: Proposal;

      let proposalId: number[];
      let descriptionHash: number[];
      let xxx;
      beforeEach(async () => {
        const api = await apiProviderWrapper.getAndWaitForReady();
        const gasLimit = api?.registry.createType('WeightV2', {
          refTime: new BN(10000),
          proofSize: new BN(10000),
        }) as WeightV2;
        const params1 = paramsToInputNumbers(govToken.abi.findMessage('PSP22::increase_allowance').toU8a([users[0].address, E12.toString()]));
        const params2 = paramsToInputNumbers(govToken.abi.findMessage('PSP22::increase_allowance').toU8a([users[1].address, E12.muln(2).toString()]));
        const params3 = paramsToInputNumbers(govToken.abi.findMessage('PSP22::increase_allowance').toU8a([users[2].address, E12.muln(3).toString()]));
        proposal = {
          rulesId: 0,
          voterRewardPartE12: toE12(0.001),
          transactions: [
            {
              callee: govToken.address,
              selector: params1.selector,
              input: params1.data,
              transferredValue: 0,
            },
            {
              callee: govToken.address,
              selector: params2.selector,
              input: params2.data,
              transferredValue: 0,
            },
            {
              callee: govToken.address,
              selector: params3.selector,
              input: params3.data,
              transferredValue: 0,
            },
          ],
        };
        proposalId = hexToNumbers(((await testEnv.hasher.query.hashProposalWithDescription(proposal, description)).value.ok! as string).substring(2));
        descriptionHash = (await testEnv.hasher.query.hashDescription(description)).value.ok!;
        await proposeAndCheck(testEnv, users[0], proposal, description, undefined);
      });

      describe(`proposal is finalized with Succeeded`, () => {
        beforeEach(async () => {
          await governor.withSigner(users[0]).tx.vote(proposalId, Vote.agreed, []);
          await governor.withSigner(users[2]).tx.vote(proposalId, Vote.agreed, []);
          await governor.withSigner(users[3]).tx.vote(proposalId, Vote.agreed, []);

          await timestmpProvider.tx.increaseBlockTimestamp(9 * DAY);
          await governor.tx.finalize(proposalId);
        });
        it('user0 executes Succeded proposal with no Tx', async () => {
          await executeAndCheck(testEnv, users[0], proposal, descriptionHash, description);

          expect((await govToken.query.allowance(governor.address, users[0].address)).value.ok!.rawNumber.toString()).to.be.equal(E12.toString());
          expect((await govToken.query.allowance(governor.address, users[1].address)).value.ok!.rawNumber.toString()).to.be.equal(
            E12.muln(2).toString(),
          );
          expect((await govToken.query.allowance(governor.address, users[2].address)).value.ok!.rawNumber.toString()).to.be.equal(
            E12.muln(3).toString(),
          );
        });
      });
    });
  });
});

function paramsToInputNumbers(params1: Uint8Array) {
  let ecdStr = '';
  for (let i = 1; i < params1.length; ++i) {
    let stemp = params1[i].toString(16);
    if (stemp.length < 2) {
      stemp = '0' + stemp;
    }
    ecdStr += stemp;
  }
  const selector = hexToNumbers(ecdStr.substring(0, 8));
  const data = hexToNumbers(ecdStr.substring(8));
  return { selector, data };
}

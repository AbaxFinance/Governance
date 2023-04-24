import Hasher from '../typechain/contracts/hasher';
import { expect } from './setup/chai';
import { hexToNumbers } from './utlis/converters/hex-number';
import { TestEnv, makeSuite } from './utlis/make-suite';
import { Proposal } from 'typechain/types-arguments/governor';

makeSuite('Hasher tests', (getTestEnv) => {
  let testEnv: TestEnv;
  let hasher: Hasher;

  beforeEach(async () => {
    testEnv = getTestEnv();
    hasher = testEnv.hasher;
  });

  it('Hasher works', async () => {
    const description = [0, 1, 2];
    const proposal: Proposal = {
      rulesId: 1,
      voterRewardPartE12: 0,
      transactions: [],
    };

    const queryRes = await hasher.query.hashProposalWithDescription(proposal, description);
  });

  it(`Hashin in different manners result in the same`, async () => {
    const description = [0, 1, 2];
    const proposal: Proposal = {
      rulesId: 1,
      voterRewardPartE12: 12,
      transactions: [],
    };

    const descriptionHash = (await hasher.query.hashDescription(description)).value.ok!;
    const proposalHash1 = hexToNumbers(((await hasher.query.hashProposal(proposal, descriptionHash)).value.ok as string).substring(2));
    const proposalHash2 = hexToNumbers(((await hasher.query.hashProposalWithDescription(proposal, description)).value.ok as string).substring(2));

    expect(proposalHash1).to.deep.equal(proposalHash2);
  });
});

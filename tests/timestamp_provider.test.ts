// import BlockTimestampProvider from '../typechain/contracts/block_timestamp_provider';
// import { expect } from './setup/chai';
// import { deployBlockTimestampProvider } from './setup/deploymentHelpers';
// import { apiProviderWrapper, getSigners } from './setup/helpers';
// import { makeSuite } from './utlis/make-suite';

// makeSuite('BlockTimestampProvider', () => {
//   let timestampProvider: BlockTimestampProvider;
//   beforeEach(async () => {
//     await apiProviderWrapper.getAndWaitForReady();
//     const [owner] = await getSigners();
//     timestampProvider = await deployBlockTimestampProvider(owner);
//   });

//   it('If mock value is set to true should return mock timestamp value', async () => {
//     await timestampProvider.tx.setShouldReturnMockValue(true);
//     await timestampProvider.tx.setBlockTimestamp(123);
//     const value = (await timestampProvider.query.getBlockTimestamp()).value.ok;
//     const timestamp = await (await apiProviderWrapper.getAndWaitForReady()).query.timestamp.now();
//     expect(value).to.equal(123);
//     expect(value).not.to.equal(timestamp);
//   });

//   it('Ifn mock value is set to false should return block timestamp', async () => {
//     await timestampProvider.tx.setShouldReturnMockValue(false);
//     await timestampProvider.tx.setBlockTimestamp(123);
//     const timestamp = await (await apiProviderWrapper.getAndWaitForReady()).query.timestamp.now();
//     const value = (await timestampProvider.query.getBlockTimestamp()).value.ok!;
//     expect(value.toString()).to.equal(timestamp.toString());
//   });
// });

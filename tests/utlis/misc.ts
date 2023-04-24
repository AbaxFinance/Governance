import BN from 'bn.js';
import chalk from 'chalk';
import { apiProviderWrapper } from 'tests/setup/helpers';
import { handleEventReturn, ReturnNumber } from '@727-ventures/typechain-types';
import { getEventTypeDescription } from 'typechain/shared/utils';
import { AnyAbacusContractEvent, ContractsEvents } from 'typechain/events/enum';
import { TestEnv } from './make-suite';
import { UnsubscribePromise, VoidFn } from '@polkadot/api/types';

import { AbiEvent } from '@polkadot/api-contract/types';

type NumericArg = number | string | BN;
export const LINE_SEPARATOR = '='.repeat(process.stdout.columns);
export const E6 = Math.pow(10, 6);
export const E8 = Math.pow(10, 8);
export const E12 = Math.pow(10, 12);
export const E18 = Math.pow(10, 18);
export const toE6 = (num: NumericArg) => (typeof num === 'number' ? num : BN.isBN(num) ? num.toNumber() : parseInt(num)) * E6;
export const toNullableNumArg = <T>(num: NumericArg | null, convert: (num: NumericArg) => T) => (num ? convert(num) : num);
export const toE12 = (num: NumericArg) => (typeof num === 'number' ? num : BN.isBN(num) ? num.toNumber() : parseInt(num)) * E12;
export const fromE6 = (num: BN | string): number => {
  if (typeof num === 'string') return parseFloat(num) / E6;
  try {
    return num.toNumber() / E6;
  } catch (e) {
    return num.divn(E6).toNumber();
  }
};
export const fromE12 = (num: BN | string): number => {
  if (typeof num === 'string') return parseFloat(num) / E12;
  try {
    return num.toNumber() / E12;
  } catch (e) {
    return num.div(new BN(E12)).toNumber();
  }
};
export const fromE18 = (num: BN | string): number => {
  if (typeof num === 'string') return parseFloat(num) / E18;
  try {
    return num.toNumber() / E18;
  } catch (e) {
    return num.div(new BN(E18)).toNumber();
  }
};

async function printTimestamp() {
  const timestamp = await (await apiProviderWrapper.getAndWaitForReady()).query.timestamp.now();
  console.log({ timestamp: timestamp.toString() });
  return timestamp;
}
// export const advanceBlockTimestamp = async function (timestampProvider: BlockTimestampProvider, forwardTime: number) {
//   await timestampProvider.tx.setShouldReturnMockValue(true);
//   const { value } = await timestampProvider.query.getBlockTimestamp();
//   await timestampProvider.tx.setBlockTimestamp(value.unwrap() + forwardTime);
// };

export function parseAmountToBN(amount: number | string) {
  const countDecimals = function (value: number | string) {
    const MAX_AMOUNT_OF_DECIMALS_JS_HANDLES = 17;
    if (!value.toString().includes('.')) return 0;
    const decimals = value.toString().split('.')[1].length || 0;
    if (decimals > MAX_AMOUNT_OF_DECIMALS_JS_HANDLES) throw 'number of decimals exceed the number that JS parseFloat can handle';
    return decimals;
  };
  const amountParsedFloat = parseFloat(amount.toString());
  const amountParsedDecimals = countDecimals(amountParsedFloat);
  const amountParsed = new BN(amountParsedFloat * Math.pow(10, amountParsedDecimals));
  return { amountParsed, amountParsedDecimals };
}
export const createEnumChecker = <T extends string, TEnumValue extends string>(enumVariable: { [key in T]: TEnumValue }) => {
  const enumValues = Object.values(enumVariable);
  return (value: string): value is TEnumValue => enumValues.includes(value);
};
export type AnyAbacusContractEventEnumLiteral<T extends AnyAbacusContractEvent> = `${T}`;

// export const subscribeOnEvent = async <TEvent extends AnyAbacusContractEventEnumLiteral<AnyAbacusContractEvent>>(
//   contract: AnyAbacusContract,
//   eventName: TEvent,
//   callback: (event: TEvent, timestamp: number) => void,
// ) => {
//   const callbackWrapper = (args: any[], event: AbiEvent, timestamp: number) => {
//     const _event: Record<string, any> = {};

//     for (let i = 0; i < args.length; i++) {
//       _event[event.args[i].name] = args[i].toJSON();
//     }

//     callback(handleEventReturn(_event, getEventTypeDescription(eventName, contract.name)) as TEvent, timestamp);
//   };
//   return __subscribeOnEvent(contract, callbackWrapper, (name: string) => name === eventName);
// };

// const __subscribeOnEvent = async (
//   contract: AnyAbacusContract,
//   callback: (args: any[], event: AbiEvent, timestamp: number) => void,
//   filter: (eventName: string) => boolean = () => true,
// ) => {
//   const api = await apiProviderWrapper.getAndWaitForReady();
//   // @ts-ignore
//   return api.query.system.events(async (events) => {
//     for (const record of events) {
//       const { event } = record;

//       if (event.method === 'ContractEmitted') {
//         const [address, data] = record.event.data;

//         if (address.toString() === contract.address.toString()) {
//           const { args, event: ev } = contract.abi.decodeEvent(data);

//           if (filter(ev.identifier.toString())) {
//             const timestamp = await api.query.timestamp.now();
//             // console.table({ eventName: ev.identifier.toString(), timestamp: timestamp.toString() });
//             callback(args, ev, parseInt(timestamp.toString()));
//           }
//         }
//       }
//     }
//   });
// };

// export const subscribeOnEvents = (
//   testEnv: TestEnv,
//   reserveName: string,
//   callback: (eventName: string, event: AnyAbacusContractEvent, emitingContract: AnyAbacusContract, timestamp: number) => void,
// ): Promise<VoidFn[]> => {
//   const { lendingPool, reserves } = testEnv;
//   const reserve = reserves[reserveName];

//   const subscribePromises: Promise<any>[] = [];
//   const callbackDecorator = (eventName: string, emitingContract: AnyAbacusContract) => (event: AnyAbacusContractEvent, timestamp: number) =>
//     callback(eventName, event, emitingContract, timestamp);

//   for (const event of Object.values(ContractsEvents.LendingPoolEvents)) {
//     subscribePromises.push(subscribeOnEvent(lendingPool, event, callbackDecorator(event, lendingPool)));
//   }
//   for (const event of Object.values(ContractsEvents.VTokenEvents)) {
//     subscribePromises.push(subscribeOnEvent(reserve.vToken, event, callbackDecorator(event, reserve.vToken)));
//   }
//   for (const event of Object.values(ContractsEvents.ATokenEvents)) {
//     subscribePromises.push(subscribeOnEvent(reserve.aToken, event, callbackDecorator(event, reserve.aToken)));
//   }

//   return Promise.all(subscribePromises);
// };

// export const getUserReserveDataDefaultObj = (): UserReserveData => {
//   return {
//     supplied: new ReturnNumber(0),
//     debt: new ReturnNumber(0),
//     appliedCumulativeSupplyRateIndexE18: new ReturnNumber(0),
//     appliedCumulativeDebtRateIndexE18: new ReturnNumber(0),
//   };
// };

export const replaceRNPropsWithStrings = function (obj) {
  if (typeof obj === 'object') {
    for (const key in obj) {
      if (obj[key]?.rawNumber) {
        obj[key] = obj[key].rawNumber.toString();
      } else if (obj[key] instanceof BN) {
        obj[key] = obj[key].toString();
      } else if (typeof obj[key] === 'object') {
        replaceRNPropsWithStrings(obj[key]);
      }
    }
  }
  return obj;
};

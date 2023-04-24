import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import type { AccountId } from '@polkadot/types/interfaces';
import BN from 'bn.js';
import { flush, proxy } from 'tests/soft-assert';
import { parseAmountToBN } from 'tests/utlis/misc';
import { E12 } from 'scripts/types_and_consts';
const softExpect = proxy(chai.expect);

export interface ExpectStaticWithSoft extends Chai.ExpectStatic {
  soft: (val: any, message?: string) => Chai.Assertion;
  flushSoft: () => void;
  toBeDefined<T>(val: T): asserts val is NonNullable<T>;
  notToBeDefined(val: unknown): asserts val is undefined | null;
}
declare global {
  export namespace Chai {
    interface Assertion {
      output(value: AccountId | string | number | boolean | string[] | number[] | unknown, msg?: string): void;
      almostEqualOrEqualNumberE12<TData extends BN | number | string>(expected: TData): void;
      equalUpTo1Digit<TData extends BN | number | string>(expected: TData): void;
    }
  }
}

chai.use(chaiAsPromised);

const almostEqualOrEqualNumberE12 = function <TData extends BN | number | string>(
  this: Chai.AssertionPrototype,
  actual: TData,
  expected: TData,
  epsilon = 0.000001,
) {
  const actualValueBN = new BN(actual);
  const expectedValueBN = new BN(expected);
  const { amountParsed: epsilonParsed, amountParsedDecimals: epsilonLeftoverDecimals } = parseAmountToBN(epsilon);
  const epsilonScaleFactor = new BN(10).pow(new BN(epsilonLeftoverDecimals));

  const diff = actualValueBN.sub(expectedValueBN).abs();
  const epsilonScaled = epsilonParsed.mul(E12).div(epsilonScaleFactor);
  this.assert(
    diff.lte(epsilonScaled),
    `expected #{act} to be almost equal or equal #{exp} | diff: ${diff} | epsilon: ${epsilonScaled}`,
    `expected #{act} not to be almost equal or equal #{exp} | diff: ${diff} | epsilon: ${epsilonScaled}`,
    expectedValueBN.toString(0),
    actualValueBN.toString(0),
    true,
  );
};

const equalUpTo1Digit = function <TData extends BN | number | string>(this: Chai.AssertionPrototype, actual: TData, expected: TData) {
  const actualValueBN = new BN(actual);
  const expectedValueBN = new BN(expected);
  this.assert(
    // x + 1 >= y >= x -1
    actualValueBN.addn(1).gte(expectedValueBN) && expectedValueBN.gte(actualValueBN.subn(1)),
    `expected #{act} to be almost equal or equal #{exp} (up to 1 digit)`,
    `expected #{act} not to be almost equal or equal #{exp} (up to 1 digit)`,
    expectedValueBN.toString(0),
    actualValueBN.toString(0),
    true,
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
chai.use((c, utils) => {
  c.Assertion.addMethod('output', async function (param, message) {
    await new c.Assertion(this._obj).to.eventually.have.property('output').to.equal(param, message);
  });

  c.Assertion.addMethod('almostEqualOrEqualNumberE12', function (this: Chai.AssertionPrototype, expected: BN | number | string) {
    const actual = (expected as BN) ? <BN>this._obj : (expected as string) ? <string>this._obj : <number>this._obj;
    almostEqualOrEqualNumberE12.apply(this, [expected, actual]);
  });
  c.Assertion.addMethod('equalUpTo1Digit', function (this: Chai.AssertionPrototype, expected: BN | number | string) {
    const actual = (expected as BN) ? <BN>this._obj : (expected as string) ? <string>this._obj : <number>this._obj;
    equalUpTo1Digit.apply(this, [expected, actual]);
  });
});
chai.config.truncateThreshold = 0;
chai.use(
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('chai-formatter-monkeypatch')(function (obj) {
    return `:\n${JSON.stringify(obj, null, 2)}`;
  }),
);

const expectWithSoft = chai.expect as ExpectStaticWithSoft;
expectWithSoft.soft = function (val: any, message?: string) {
  return softExpect(val, message);
};
expectWithSoft.flushSoft = flush;

expectWithSoft.toBeDefined = function <T>(val: T | null): asserts val is NonNullable<T> {
  chai.assert(val !== null && val !== undefined, `expected ${val} not to be null or undefined`);
};
expectWithSoft.notToBeDefined = function (val: unknown): asserts val is undefined | null {
  chai.assert(val === null || val === undefined, `expected ${val} to be null or undefined`);
};

export const expect: ExpectStaticWithSoft = expectWithSoft;

export function assertExists<T>(maybe: T): asserts maybe is NonNullable<T> {
  if (maybe === null || maybe === undefined) throw new Error(`${maybe} doesn't exist`);
}
export function expectExists<T>(maybe: T): asserts maybe is NonNullable<T> {
  if (maybe === null || maybe === undefined) throw new Error(`${maybe} doesn't exist`);
}

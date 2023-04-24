import BN from 'bn.js';
import { parseAmountToBN } from 'tests/utlis/misc';

export const oneEther = new BN(Math.pow(10, 18).toString());

const mutliplyBy = (b: BN, amount: string | number) => {
  const { amountParsed, amountParsedDecimals } = parseAmountToBN(amount.toString());
  return b.mul(amountParsed).div(new BN(Math.pow(10, amountParsedDecimals).toString()));
};

export interface ReserveTokenDeploymentData {
  name: string;
  address: string;
  decimals: number;
  feeD6: number;
  collateralCoefficient: null | number;
  borrowCoefficient: null | number;
  maximalTotalSupply: null | BN;
  maximalTotalDebt: null | BN;
  minimalCollateral: number | BN;
  minimalDebt: number | BN;
  penalty: number;
  flashLoanFeeE6: number;
  stableBaseRate: number;
}

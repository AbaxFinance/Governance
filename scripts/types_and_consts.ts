import BN from 'bn.js';
import { Hash } from 'typechain/types-returns/governor';

export type AccountId = string;
export type U128 = BN;
export type Balance = U128;
export type Timestamp = number;

export const SECOND: Timestamp = 1000;
export const MINUTE: Timestamp = 60 * SECOND;
export const HOUR: Timestamp = 60 * MINUTE;
export const DAY: Timestamp = 24 * HOUR;
export const YEAR: Timestamp = 365 * DAY;

export type Option<T> = null | T;

export const E6 = new BN(10 ** 6);
export const E9 = new BN(10 ** 9);
export const E12 = new BN(10 ** 12);
export const E18 = E6.mul(E12);
export const E21 = E9.mul(E12);

export const MINTER = 4_254_773_782;
export const BURNER = 1_711_057_910;

export type ProposalId = Hash;
export type RulesId = number;

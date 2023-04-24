import BN from 'bn.js';

//TODO populate/remove after addition of roles tests
export const Roles = {
  DefaultAdminRole: 0,
  Minter: 0xfd9ab216,
};

export enum RateMode {
  None = '0',
  Stable = '1',
  Variable = '2',
}

export enum LendingToken {
  AToken = 'AToken',
  VToken = 'VToken',
  SToken = 'SToken',
}
export const ONE_YEAR = new BN('31536000');

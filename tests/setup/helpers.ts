import { createTestKeyring } from '@polkadot/keyring/testing';
import { KeyringPair } from '@polkadot/keyring/types';
import { ApiProviderWrapper } from './ApiProviderWrapper';

export const apiProviderWrapper = new ApiProviderWrapper(process.env.WS_ENDPOINT ?? 'ws://127.0.0.1:9944');
export const getSigners = () => {
  return createTestKeyring({ type: 'sr25519' }).pairs;
};
export const getSignersWithoutOwner = (signers: KeyringPair[], ownerIndex: number) => [
  ...signers.slice(0, ownerIndex),
  ...signers.slice(ownerIndex + 1),
];
export function converSignerToAddress(signer?: KeyringPair | string): string {
  if (!signer) return '';
  return typeof signer !== 'string' ? signer.address : signer;
}

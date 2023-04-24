import { GasLimit, QueryReturnType } from '@727-ventures/typechain-types';
export interface PSP22Metadata {
  methods: {
    'tokenDecimals'(__options: GasLimit): Promise<QueryReturnType<number>>;
    'tokenName'(__options: GasLimit): Promise<QueryReturnType<string | null>>;
    'tokenSymbol'(__options: GasLimit): Promise<QueryReturnType<string | null>>;
  };
}

declare module 'viem' {
  export type Address = `0x${string}`;
  export type Hash = `0x${string}`;
  export type Chain = {
    id: number;
    name: string;
    nativeCurrency: {
      name: string;
      symbol: string;
      decimals: number;
    };
    rpcUrls: Record<string, { http: string[] }>;
    blockExplorers?: Record<string, { name: string; url: string }>;
    testnet?: boolean;
  };
  export type WalletClient = any;
  export const zeroAddress: Address;
  export const createPublicClient: <T>(config: T) => any;
  export const createWalletClient: <T>(config: T) => any;
  export const http: (...args: any[]) => any;
  export const parseEther: (value: string) => bigint;
  export const toHex: (value: string, options?: { size?: number }) => `0x${string}`;
  export const encodeFunctionData: (args: any) => `0x${string}`;
}

declare module 'viem/accounts' {
  export type Address = `0x${string}`;
  export type Account = { address: Address; [key: string]: any };
  export const privateKeyToAccount: (privateKey: Address) => Account;
}

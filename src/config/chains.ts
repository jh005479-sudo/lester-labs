import { defineChain } from 'viem'

// LitVM LiteForge testnet — source-pinned to the endpoint published in the
// official LitVM network parameters. Hosting environment variables must not
// substitute this transaction/read target.
export const litvm = defineChain({
  id: 4441,
  name: 'LitVM LiteForge',
  nativeCurrency: { name: 'zkLTC', symbol: 'zkLTC', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.liteforge.zeeve.net/'],
    },
  },
  blockExplorers: {
    default: { name: 'LiteForge Explorer', url: 'https://explorer.testnet.liteforge.zeeve.net' },
  },
  testnet: true,
})

export const supportedChains = [litvm] as const

import { defineChain } from 'viem'

// Arbitrum Sepolia as proxy until LitVM testnet publishes network constants
export const arbitrumSepolia = {
  id: 421614,
  name: 'Arbitrum Sepolia (LitVM Proxy)',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sepolia-rollup.arbitrum.io/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Arbiscan', url: 'https://sepolia.arbiscan.io' },
  },
  testnet: true,
} as const

// LitVM Testnet — Caldera Arbitrum Nitro rollup (Chain ID 4441)
export const litvm = defineChain({
  id: 4441,
  name: 'LitVM Testnet',
  nativeCurrency: { name: 'zkLTC', symbol: 'zkLTC', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://liteforge.rpc.caldera.xyz/http'],
      webSocket: ['wss://liteforge.rpc.caldera.xyz/ws'],
    },
  },
  blockExplorers: {
    default: { name: 'LiteForge Explorer', url: 'https://liteforge.explorer.caldera.xyz' },
  },
  testnet: true,
})

export const supportedChains = [litvm, arbitrumSepolia] as const

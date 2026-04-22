import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { createConfig, http, injected } from 'wagmi'
import { litvm, arbitrumSepolia } from './chains'

const FALLBACK_WALLETCONNECT_PROJECT_ID = 'walletconnect-not-configured'

export const walletConnectConfigured = Boolean(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim())

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? FALLBACK_WALLETCONNECT_PROJECT_ID

const chains = [litvm, arbitrumSepolia] as const

export const wagmiConfig = walletConnectConfigured
  ? getDefaultConfig({
      appName: 'Lester-Labs',
      projectId: walletConnectProjectId,
      chains,
      ssr: true,
    })
  : createConfig({
      chains,
      connectors: [
        injected(),
      ],
      transports: {
        [litvm.id]: http(litvm.rpcUrls.default.http[0]),
        [arbitrumSepolia.id]: http(arbitrumSepolia.rpcUrls.default.http[0]),
      },
      ssr: true,
    })

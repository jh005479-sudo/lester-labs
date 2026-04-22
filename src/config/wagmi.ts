import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { litvm, arbitrumSepolia } from './chains'

const FALLBACK_WALLETCONNECT_PROJECT_ID = 'walletconnect-not-configured'

export const walletConnectConfigured = Boolean(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim())

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? FALLBACK_WALLETCONNECT_PROJECT_ID

export const wagmiConfig = getDefaultConfig({
  appName: 'Lester-Labs',
  projectId: walletConnectProjectId,
  chains: [litvm, arbitrumSepolia],
  ssr: true,
})

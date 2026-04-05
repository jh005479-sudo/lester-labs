import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { arbitrumSepolia } from './chains'

// RP-008: Read WalletConnect project ID from environment variable
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

if (!walletConnectProjectId) {
  throw new Error(
    'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. ' +
    'Please add it to your .env.local file. ' +
    'Get a project ID at https://cloud.walletconnect.com/'
  )
}

export const wagmiConfig = getDefaultConfig({
  appName: 'Lester-Labs',
  projectId: walletConnectProjectId,
  chains: [arbitrumSepolia],
  ssr: true,
})

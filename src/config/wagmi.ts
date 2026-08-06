import { createConfig, http, injected } from 'wagmi'
import { litvm } from './chains'

// Keep wallet connectivity deterministic while hosting and deployment accounts
// are being re-established. A mutable build-time project ID must not silently
// alter the reviewed connector set. Re-enable WalletConnect only with a
// separately reviewed, source-pinned public project configuration.
export const walletConnectConfigured = false

const chains = [litvm] as const

export const wagmiConfig = createConfig({
  chains,
  multiInjectedProviderDiscovery: false,
  connectors: [
    injected(),
  ],
  transports: {
    [litvm.id]: http(litvm.rpcUrls.default.http[0]),
  },
  ssr: true,
})

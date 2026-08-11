import { createConfig, http, injected } from 'wagmi'
import { litvm } from './chains'

export const walletConnectConfigured = false

export const wagmiConfig = createConfig({
  chains: [litvm],
  multiInjectedProviderDiscovery: false,
  connectors: [injected()],
  transports: {
    [litvm.id]: http(litvm.rpcUrls.default.http[0]),
  },
  ssr: true,
})

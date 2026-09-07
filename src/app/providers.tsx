'use client'

import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { wagmiConfig } from '@/config/wagmi'
import { useState } from 'react'
import NetworkGuard from '@/components/shared/NetworkGuard'
import { TransactionMonitor } from '@/components/shared/TransactionMonitor'
import { UsageTracker } from '@/components/shared/UsageTracker'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <NetworkGuard />
        <TransactionMonitor />
        <UsageTracker />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}

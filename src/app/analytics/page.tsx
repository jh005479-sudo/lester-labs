'use client'

import Link from 'next/link'
import * as Tabs from '@radix-ui/react-tabs'
import { ArrowUpRight } from 'lucide-react'
import { HealthPanel } from '@/components/analytics/HealthPanel'
import { GasAnalyticsPanel } from '@/components/analytics/GasAnalyticsPanel'
import { ActivityIndexPanel } from '@/components/analytics/ActivityIndexPanel'

export default function AnalyticsPage() {
  return <main className="workspace-page">
    <header className="workspace-heading"><div><p className="workspace-eyebrow">Explore LitVM</p><h1>Activity, at a glance.</h1><p>Discover recent tokens and check the network.</p></div><Link href="/charts" className="workspace-button secondary">Browse markets <ArrowUpRight size={16} /></Link></header>
    <Tabs.Root defaultValue="network">
      <Tabs.List aria-label="Analytics views" className="mb-7 flex gap-2 overflow-x-auto">{[['network', 'Network'], ['tokens', 'Tokens'], ['pairs', 'New pools']].map(([value, label]) => <Tabs.Trigger key={value} value={value} className="workspace-button secondary data-[state=active]:border-violet-400 data-[state=active]:bg-violet-500/15">{label}</Tabs.Trigger>)}</Tabs.List>
      <Tabs.Content value="network"><div className="grid items-start gap-5 lg:grid-cols-2"><HealthPanel /><GasAnalyticsPanel /></div></Tabs.Content>
      <Tabs.Content value="tokens"><ActivityIndexPanel source="tokens" /></Tabs.Content>
      <Tabs.Content value="pairs"><ActivityIndexPanel source="pairs" /></Tabs.Content>
    </Tabs.Root>
    <details className="workspace-details"><summary>What’s coming next?</summary><p>Price trends, bridge activity, and wallet rankings need additional data coverage. We’ll add them when their figures can be checked.</p><p>Testnet balances and reserve ratios do not represent monetary value.</p></details>
  </main>
}

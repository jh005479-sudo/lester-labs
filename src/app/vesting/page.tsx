'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { VestingForm } from '@/components/vesting/VestingForm'
import { MySchedules } from '@/components/vesting/MySchedules'
import { PUBLIC_RELEASE_STATUS } from '@/lib/publicReleaseStatus'

export default function VestingPage() {
  const { isConnected } = useAccount()
  const [tab, setTab] = useState<'create' | 'my'>('create')
  useEffect(() => { if (new URLSearchParams(window.location.search).get('tab') === 'my') queueMicrotask(() => setTab('my')) }, [])
  return <main className="workspace-page narrow">
    <header className="workspace-heading"><div><p className="workspace-eyebrow">Token vesting · LitVM testnet</p><h1>Plan your token releases</h1><p>Create a release schedule, or check tokens available to claim.</p></div></header>
    {!PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled && <p className="workspace-notice">New schedules are paused. You can still inspect eligible existing positions.</p>}
    <div className="mb-6 flex flex-wrap gap-3" role="group" aria-label="Vesting view">
      <button className={`workspace-button ${tab === 'create' ? '' : 'secondary'}`} aria-pressed={tab === 'create'} onClick={() => setTab('create')}>New schedule</button>
      <button className={`workspace-button ${tab === 'my' ? '' : 'secondary'}`} aria-pressed={tab === 'my'} onClick={() => setTab('my')}>Find a schedule</button>
      <Link className="workspace-button secondary" href="/portfolio">View portfolio</Link>
    </div>
    {!isConnected && <p className="workspace-note mb-6">You can prepare and look up details now. Connect your wallet when you’re ready to create or claim. <Link href="/setup?next=/vesting" className="text-violet-300 underline">Get set up</Link></p>}
    {tab === 'create' ? <VestingForm /> : <MySchedules />}
  </main>
}

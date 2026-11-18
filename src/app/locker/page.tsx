'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { LOCKER_DEPOSITS_PAUSED } from '@/config/contracts'
import { LockForm } from '@/components/locker/LockForm'
import { MyLocks } from '@/components/locker/MyLocks'
import { PUBLIC_RELEASE_STATUS } from '@/lib/publicReleaseStatus'

export default function LockerPage() {
  const { isConnected } = useAccount()
  const creationAvailable = PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled && !LOCKER_DEPOSITS_PAUSED
  const [tab, setTab] = useState<'create' | 'my-locks'>(creationAvailable ? 'create' : 'my-locks')
  useEffect(() => { if (new URLSearchParams(window.location.search).get('tab') === 'my-locks') queueMicrotask(() => setTab('my-locks')) }, [])
  return <main className="workspace-page narrow">
    <header className="workspace-heading"><div><p className="workspace-eyebrow">Liquidity locks · LitVM testnet</p><h1>Lock your liquidity</h1><p>Set an unlock date for LP tokens, or check an existing lock.</p></div></header>
    {!creationAvailable && <p className="workspace-notice">New deposits are paused until the replacement locker verifies the amount received. Existing locks can be checked and eligible withdrawals remain available.</p>}
    <div className="mb-6 flex flex-wrap gap-3" role="group" aria-label="Locker view">
      <button disabled={!creationAvailable} className={`workspace-button ${tab === 'create' ? '' : 'secondary'}`} aria-pressed={tab === 'create'} onClick={() => setTab('create')}>New lock</button>
      <button className={`workspace-button ${tab === 'my-locks' ? '' : 'secondary'}`} aria-pressed={tab === 'my-locks'} onClick={() => setTab('my-locks')}>Find a lock</button>
      <Link className="workspace-button secondary" href="/locker/verify">Verify a certificate</Link>
    </div>
    {!isConnected && <p className="workspace-note mb-6">Look up a certificate without connecting. Connect the withdrawal wallet to manage an existing lock. <Link href="/setup?next=/locker" className="text-violet-300 underline">Get set up</Link></p>}
    {creationAvailable && tab === 'create' ? <LockForm /> : <MyLocks />}
  </main>
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAccount, useBalance } from 'wagmi'
import { CheckCircle2, Circle, ExternalLink, Wallet } from 'lucide-react'
import { InjectedWalletButton } from '@/components/shared/InjectedWalletButton'
import { useLitvmNetwork } from '@/hooks/useLitvmNetwork'
import { safeReturnPath } from '@/lib/projectJourney'
import { litvm } from '@/config/chains'
import { UsagePreference } from '@/components/shared/UsagePreference'

export default function SetupPage() {
  const { address, isConnected } = useAccount()
  const { isWrongNetwork, isSwitchingChain, switchToLitvm } = useLitvmNetwork()
  const balance = useBalance({ address, chainId: litvm.id, query: { enabled: Boolean(address), refetchInterval: 15_000 } })
  const [next, setNext] = useState('/projects')
  const [error, setError] = useState('')
  useEffect(() => { queueMicrotask(() => setNext(safeReturnPath(new URLSearchParams(window.location.search).get('next')))) }, [])
  const hasGas = balance.data !== undefined && balance.data.value > 0n
  const steps = [
    { title: 'Connect a test wallet', detail: 'Use a browser extension, or open Lester Labs inside your mobile wallet.', done: isConnected },
    { title: 'Switch to LitVM', detail: 'Your wallet should show LitVM LiteForge, chain 4441.', done: isConnected && !isWrongNetwork },
    { title: 'Get test zkLTC', detail: 'Test zkLTC covers transaction fees. Get it from the official testnet hub.', done: hasGas },
  ]
  return <main className="workspace-page narrow">
    <header className="workspace-heading"><div><p className="workspace-eyebrow">A quick start</p><h1>Ready for your first transaction?</h1><p>Set up your wallet, then return to what you were doing.</p></div><Wallet size={28} className="hidden text-violet-300 sm:block" /></header>
    <section className="workspace-panel"><ol className="workspace-list">{steps.map((step, index) => <li key={step.title}>
      {step.done ? <CheckCircle2 size={24} className="mt-1 self-start text-emerald-300" /> : <Circle size={24} className="mt-1 self-start text-violet-300" />}
      <div className="min-w-0 flex-1"><h2>{index + 1}. {step.title}</h2><p>{step.detail}</p>{index === 0 && !isConnected && <div className="mt-4"><InjectedWalletButton /></div>}{index === 1 && isConnected && isWrongNetwork && <button type="button" className="workspace-button mt-4" disabled={isSwitchingChain} onClick={async () => { const result = await switchToLitvm(); if (!result.switched) setError(result.error) }}>{isSwitchingChain ? 'Switching…' : 'Switch network'}</button>}{index === 2 && <div className="mt-4 flex flex-wrap items-center gap-4"><a href="https://testnet.litvm.com/" target="_blank" rel="noopener noreferrer" className="workspace-button secondary">Open testnet hub <ExternalLink size={15} /></a>{address && <button type="button" className="workspace-button secondary" onClick={() => void balance.refetch()}>Check balance</button>}</div>}</div>
    </li>)}</ol>{error && <p className="workspace-notice" role="alert">{error}</p>}</section>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4"><p className="workspace-note">Use test tokens only. Keep your recovery phrase private.</p><Link href={next} className="workspace-button">{isConnected && !isWrongNetwork && hasGas ? 'Continue' : 'Explore while you get set up'} →</Link></div>
    <UsagePreference />
  </main>
}

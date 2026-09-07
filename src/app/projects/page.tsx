'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Rocket, ArrowUpRight, Plus, Layers3 } from 'lucide-react'
import { validAddress } from '@/lib/projectJourney'

export default function ProjectsPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [projects, setProjects] = useState<Array<{ token: string; name: string }>>([])
  useEffect(() => {
    const refresh = () => {
      try {
        const raw = localStorage.getItem('lester:projects:v1')
        if (!raw || raw.length > 20_000) return
        const saved: unknown = JSON.parse(raw)
        if (Array.isArray(saved)) setProjects(saved.filter((entry) => validAddress(entry?.token) && typeof entry.name === 'string' && entry.name.length <= 50).slice(0, 20))
      } catch { /* Nothing saved on this device. */ }
    }
    queueMicrotask(refresh)
    window.addEventListener('lester:projects-changed', refresh)
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener('lester:projects-changed', refresh); window.removeEventListener('storage', refresh) }
  }, [])
  return <main className="workspace-page">
    <header className="workspace-heading"><div><p className="workspace-eyebrow">From idea to launch</p><h1>Build your next project.</h1><p>Create a token, add liquidity, and plan your launch in one place.</p></div><Link className="workspace-button secondary" href="/setup">Get set up <ArrowUpRight size={16} /></Link></header>
    <div className="grid gap-5 md:grid-cols-2">
      <section className="workspace-panel workspace-step"><Rocket className="text-violet-300" size={26} /><h2>Start with a token</h2><p>Choose a name, supply, and features. Your draft stays here until you’re ready.</p><Link href="/launch" className="workspace-button"><Plus size={16} />Create or resume a token</Link></section>
      <section className="workspace-panel workspace-step"><Layers3 className="text-cyan-300" size={26} /><h2>Already have a token?</h2><p>Open its project page to plan liquidity, vesting, and distribution.</p><form className="workspace-form" onSubmit={(event) => { event.preventDefault(); if (!validAddress(token.trim())) { setError('Enter a valid token address.'); return } router.push(`/projects/${token.trim().toLowerCase()}`) }}><label>Token address<input value={token} onChange={(event) => setToken(event.target.value)} maxLength={42} placeholder="0x…" autoComplete="off" spellCheck={false} /></label><button className="workspace-button secondary" type="submit">Open project</button></form>{error && <p role="alert">{error}</p>}</section>
    </div>
    {projects.length > 0 && <section className="mt-10"><div className="workspace-heading"><div><h2 className="text-2xl font-semibold">Your recent projects</h2><p>Saved on this device.</p></div></div><div className="workspace-grid">{projects.map((entry) => <Link key={entry.token} href={`/projects/${entry.token}`} className="workspace-panel workspace-step no-underline text-white"><h2>{entry.name}</h2><p className="font-mono">{entry.token.slice(0, 8)}…{entry.token.slice(-6)}</p><span className="text-sm text-violet-300">Continue project →</span></Link>)}</div></section>}
    <p className="workspace-note mt-8">All projects run on LitVM testnet. Use test tokens only.</p>
  </main>
}

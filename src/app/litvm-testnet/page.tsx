import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'LitVM LiteForge Testnet Safety Guide | Lester Labs',
  description: 'Source-checked LiteForge network parameters and Lester Labs post-compromise service status. Testnet behaviour is not a mainnet guarantee.',
  alternates: { canonical: 'https://www.lester-labs.com/litvm-testnet' },
}

const parameters = [
  ['Network', 'LitVM LiteForge'],
  ['Chain ID', '4441'],
  ['Gas symbol', 'zkLTC (testnet)'],
  ['RPC', 'https://liteforge.rpc.caldera.xyz/http'],
  ['Explorer', 'https://liteforge.explorer.caldera.xyz'],
] as const

export default function LitvmTestnetPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-28 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Testnet safety guide</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl">Verify LiteForge before connecting</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-white/55">
          Cross-check these values at LitVM&apos;s independently located official testnet hub. Testnet assets are for
          testing; the network, bridge, contracts, fees, and behaviour do not guarantee any future mainnet deployment.
          Lester Labs ordinary writes remain disabled during its post-compromise cutover.
        </p>
        <dl className="mt-10 overflow-hidden rounded-2xl border border-white/10">
          {parameters.map(([label, value]) => (
            <div key={label} className="grid gap-1 border-b border-white/10 bg-white/[0.025] px-5 py-4 last:border-b-0 sm:grid-cols-[140px,1fr]">
              <dt className="text-xs font-bold uppercase tracking-wider text-white/35">{label}</dt>
              <dd className="break-all font-mono text-sm text-white/75">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-6 text-sm leading-6 text-amber-100/75">
          Use a disposable wallet. A legitimate faucet needs only a public address—not LTC, a seed phrase, or a private
          key. Find the current faucet through LitVM&apos;s official hub; availability and limits can change.
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <a href="https://testnet.litvm.com" rel="noreferrer" className="rounded-lg bg-[#6B4FFF] px-5 py-3 text-sm font-semibold">Open official testnet hub</a>
          <Link href="/explorer" className="rounded-lg border border-white/10 px-5 py-3 text-sm font-semibold text-white/70">Open read-only explorer</Link>
        </div>
      </div>
    </main>
  )
}

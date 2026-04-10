'use client'

import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const DEMO_BADGE = (
  <span className="inline-block ml-2 text-[10px] uppercase tracking-wider text-yellow-400/70 border border-yellow-400/30 rounded px-1.5 py-0.5">demo data</span>
)

const pools = [
  { pair: 'zkLTC / ETH', tvl: 12450, vol: 2340, change: -3.2 },
  { pair: 'USDC / zkLTC', tvl: 8200, vol: 1890, change: 1.1 },
  { pair: 'WBTC / zkLTC', tvl: 5100, vol: 920, change: 0.8 },
  { pair: 'ETH / USDC', tvl: 3800, vol: 1450, change: -0.4 },
  { pair: 'zkLTC / MATIC', tvl: 2100, vol: 340, change: 2.7 },
]

const poolDistribution = pools.map(p => ({ name: p.pair, value: p.tvl }))
const COLORS = ['#6366f1', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444']

const swaps = [
  { hash: '0x3f8a...b1c2', from: '0x1a2b...3c4d', to: '0x5e6f...7a8b', amount: '1,250 zkLTC', impact: '0.12%' },
  { hash: '0x7d2e...c4d5', from: '0x9a0b...1c2d', to: '0x3e4f...5a6b', amount: '0.45 ETH', impact: '0.08%' },
  { hash: '0xa1b3...e5f6', from: '0x7c8d...9e0f', to: '0x1a2b...3c4d', amount: '500 USDC', impact: '0.03%' },
  { hash: '0xc4d7...a9b0', from: '0x5e6f...7a8b', to: '0xd1e2...f3a4', amount: '0.02 WBTC', impact: '0.21%' },
  { hash: '0xe8f1...2b3c', from: '0xb5c6...d7e8', to: '0x9a0b...1c2d', amount: '3,000 zkLTC', impact: '0.15%' },
]

const volumeData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i.toString().padStart(2, '0')}:00`,
  volume: [120, 85, 42, 38, 25, 30, 55, 180, 420, 580, 490, 350, 280, 310, 450, 620, 510, 380, 290, 340, 260, 190, 150, 110][i],
}))

const fmt = (n: number) => n.toLocaleString('en-US')

export function DexPanel() {
  return (
    <div>
      <div className="flex items-center mb-6">
        <h2 className="text-xl font-bold text-white">DEX Dashboard</h2>
        {DEMO_BADGE}
      </div>

      {/* Pool list */}
      <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5 mb-6">
        <h3 className="text-sm font-semibold text-white mb-4">Top Liquidity Pools</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/5">
                <th className="text-left py-2 px-3">Pair</th>
                <th className="text-right py-2 px-3">TVL</th>
                <th className="text-right py-2 px-3">24h Volume</th>
                <th className="text-right py-2 px-3">24h Change</th>
              </tr>
            </thead>
            <tbody>
              {pools.map((p, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-3 px-3 font-mono font-semibold text-white">{p.pair}</td>
                  <td className="py-3 px-3 font-mono text-white/80 text-right">${fmt(p.tvl)}</td>
                  <td className="py-3 px-3 font-mono text-white/80 text-right">${fmt(p.vol)}</td>
                  <td className={`py-3 px-3 font-mono text-right ${p.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {p.change >= 0 ? '+' : ''}{p.change}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Pool distribution */}
        <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">TVL Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={poolDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} strokeWidth={0}>
                {poolDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {poolDistribution.map((p, i) => (
              <span key={i} className="flex items-center gap-1.5 text-xs text-white/60">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                {p.name}
              </span>
            ))}
          </div>
        </div>

        {/* 24h volume chart */}
        <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">24h Volume</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={volumeData}>
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="volume" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Swap history */}
      <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Recent Swaps</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/5">
                <th className="text-left py-2 px-3">Tx Hash</th>
                <th className="text-left py-2 px-3">From</th>
                <th className="text-left py-2 px-3">To</th>
                <th className="text-right py-2 px-3">Amount</th>
                <th className="text-right py-2 px-3">Price Impact</th>
              </tr>
            </thead>
            <tbody>
              {swaps.map((s, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-2.5 px-3 font-mono text-xs text-[var(--accent)]">{s.hash}</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-white/60">{s.from}</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-white/60">{s.to}</td>
                  <td className="py-2.5 px-3 font-mono text-white/80 text-right">{s.amount}</td>
                  <td className="py-2.5 px-3 font-mono text-white/50 text-right">{s.impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


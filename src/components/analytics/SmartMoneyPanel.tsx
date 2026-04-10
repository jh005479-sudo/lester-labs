'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Crown, Bell, TrendingUp } from 'lucide-react'

const DEMO_BADGE = (
  <span className="inline-block ml-2 text-[10px] uppercase tracking-wider text-yellow-400/70 border border-yellow-400/30 rounded px-1.5 py-0.5">demo data</span>
)

const whales = [
  { addr: '0x1a2b...3c4d', value: 2400000, lastActive: '2h ago' },
  { addr: '0x5e6f...7a8b', value: 1800000, lastActive: '6h ago' },
  { addr: '0x9c0d...1e2f', value: 1250000, lastActive: '1h ago' },
  { addr: '0x3a4b...5c6d', value: 980000, lastActive: '4h ago' },
  { addr: '0x7e8f...9a0b', value: 870000, lastActive: '30m ago' },
  { addr: '0xb1c2...d3e4', value: 720000, lastActive: '12h ago' },
  { addr: '0xf5a6...b7c8', value: 650000, lastActive: '8h ago' },
  { addr: '0xd9e0...f1a2', value: 540000, lastActive: '3h ago' },
  { addr: '0xa3b4...c5d6', value: 480000, lastActive: '5h ago' },
  { addr: '0xe7f8...a9b0', value: 410000, lastActive: '1d ago' },
]

const alerts = [
  { wallet: '0x1a2b...3c4d', action: 'accumulated 50,000 zkLTC', time: '2h ago', type: 'buy' },
  { wallet: '0x9c0d...1e2f', action: 'bridged $180K from Ethereum', time: '1h ago', type: 'bridge' },
  { wallet: '0x5e6f...7a8b', action: 'swapped 2.4 ETH → USDC', time: '6h ago', type: 'swap' },
  { wallet: '0x7e8f...9a0b', action: 'added $45K to zkLTC/ETH pool', time: '30m ago', type: 'lp' },
  { wallet: '0x1a2b...3c4d', action: 'claimed 12,000 zkLTC staking rewards', time: '4h ago', type: 'claim' },
  { wallet: '0x3a4b...5c6d', action: 'bridged $95K from Arbitrum', time: '4h ago', type: 'bridge' },
  { wallet: '0xb1c2...d3e4', action: 'accumulated 8,500 zkLTC', time: '12h ago', type: 'buy' },
]

const tokenPicks = [
  { token: 'zkLTC', holders: 8, trend: 'accumulating', change: '+12%' },
  { token: 'ETH', holders: 6, trend: 'stable', change: '+2%' },
  { token: 'USDC', holders: 5, trend: 'rotating in', change: '+5%' },
  { token: 'WBTC', holders: 3, trend: 'accumulating', change: '+8%' },
]

const portfolioDist = [
  { name: 'zkLTC', value: 45 },
  { name: 'Stablecoins', value: 25 },
  { name: 'ETH', value: 18 },
  { name: 'WBTC', value: 8 },
  { name: 'Other', value: 4 },
]
const COLORS = ['#6366f1', '#22c55e', '#8b5cf6', '#f59e0b', '#ef4444']

const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}K`

const alertColor = (type: string) => {
  switch (type) {
    case 'buy': return 'text-green-400'
    case 'swap': return 'text-blue-400'
    case 'bridge': return 'text-purple-400'
    case 'lp': return 'text-yellow-400'
    case 'claim': return 'text-cyan-400'
    default: return 'text-white/60'
  }
}

export function SmartMoneyPanel() {
  return (
    <div>
      <div className="flex items-center mb-6">
        <h2 className="text-xl font-bold text-white">Smart Money Tracker</h2>
        {DEMO_BADGE}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Whale leaderboard */}
        <div className="analytics-card lg:col-span-2 rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Crown className="h-4 w-4 text-yellow-400" /> Whale Leaderboard
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/5">
                  <th className="text-left py-2 px-3">#</th>
                  <th className="text-left py-2 px-3">Address</th>
                  <th className="text-right py-2 px-3">Portfolio</th>
                  <th className="text-right py-2 px-3">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {whales.map((w, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2.5 px-3 text-white/40">{i + 1}</td>
                    <td className="py-2.5 px-3 font-mono text-xs text-[var(--accent)]">{w.addr}</td>
                    <td className="py-2.5 px-3 font-mono text-white/80 text-right">{fmt(w.value)}</td>
                    <td className="py-2.5 px-3 font-mono text-white/50 text-right">{w.lastActive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Portfolio distribution */}
        <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Whale Portfolio Split</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={portfolioDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} strokeWidth={0}>
                {portfolioDist.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-1.5 mt-2">
            {portfolioDist.map((p, i) => (
              <span key={i} className="flex items-center gap-1.5 text-xs text-white/60">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                {p.name} — {p.value}%
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Smart money alerts */}
        <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Bell className="h-4 w-4 text-yellow-400" /> Smart Money Alerts
          </h3>
          <div className="space-y-3">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-white/40 text-xs mt-0.5 font-mono shrink-0">{a.time}</span>
                <div>
                  <span className={`font-mono text-xs ${alertColor(a.type)}`}>{a.wallet}</span>
                  <span className="text-white/60 text-xs ml-1.5">{a.action}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Token picks */}
        <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-400" /> Smart Money Token Picks
          </h3>
          <div className="space-y-3">
            {tokenPicks.map((t, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <div>
                  <span className="font-mono font-semibold text-white text-sm">{t.token}</span>
                  <span className="text-white/40 text-xs ml-2">{t.trend}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-white/40">{t.holders} whales</span>
                  <span className="ml-3 text-xs font-mono text-green-400">{t.change}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}


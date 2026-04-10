'use client'

import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { ArrowDownToLine, ArrowUpFromLine, Clock, Landmark } from 'lucide-react'

const DEMO_BADGE = (
  <span className="inline-block ml-2 text-[10px] uppercase tracking-wider text-yellow-400/70 border border-yellow-400/30 rounded px-1.5 py-0.5">demo data</span>
)

const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color?: string }) => (
  <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
    <div className="flex items-center gap-2 mb-2">
      <Icon className={`h-4 w-4 ${color ?? 'text-[var(--accent)]'}`} />
      <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-2xl font-bold font-mono text-white">{value}</p>
  </div>
)

const flowData = Array.from({ length: 14 }, (_, i) => ({
  day: `Apr ${i + 1}`,
  inflow: [8200, 12400, 9800, 15600, 11200, 7400, 13100, 18900, 14200, 9600, 16800, 11400, 13700, 10200][i],
  outflow: [3100, 5800, 4200, 7100, 4900, 2800, 6200, 9400, 6800, 3900, 7200, 5100, 6400, 4800][i],
}))

const sources = [
  { name: 'Ethereum', value: 60 },
  { name: 'Arbitrum', value: 25 },
  { name: 'Optimism', value: 10 },
  { name: 'Other', value: 5 },
]
const COLORS = ['#6366f1', '#8b5cf6', '#22c55e', '#f59e0b']

const bridges = [
  { hash: '0xab12...34cd', chain: 'Ethereum', amount: '$24,500', token: 'ETH', time: '2 min ago', status: 'Confirmed' },
  { hash: '0xef56...78gh', chain: 'Arbitrum', amount: '$12,800', token: 'USDC', time: '8 min ago', status: 'Confirmed' },
  { hash: '0xcd78...90ij', chain: 'Ethereum', amount: '$8,200', token: 'WBTC', time: '23 min ago', status: 'Confirmed' },
  { hash: '0xgh90...12kl', chain: 'Optimism', amount: '$5,400', token: 'ETH', time: '41 min ago', status: 'Confirmed' },
  { hash: '0xij34...56mn', chain: 'Ethereum', amount: '$31,200', token: 'USDC', time: '1h ago', status: 'Confirmed' },
  { hash: '0xkl78...90op', chain: 'Arbitrum', amount: '$6,700', token: 'ETH', time: '1h 15m ago', status: 'Pending' },
  { hash: '0xmn12...34qr', chain: 'Ethereum', amount: '$18,900', token: 'ETH', time: '2h ago', status: 'Confirmed' },
]

export function BridgePanel() {
  return (
    <div>
      <div className="flex items-center mb-6">
        <h2 className="text-xl font-bold text-white">Bridge Dashboard</h2>
        {DEMO_BADGE}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard icon={ArrowDownToLine} label="24h Volume" value="$156K" />
        <StatCard icon={ArrowUpFromLine} label="7d Volume" value="$1.2M" />
        <StatCard icon={Landmark} label="30d Volume" value="$4.8M" />
        <StatCard icon={Clock} label="Avg Bridge Time" value="4.2 min" />
        <StatCard icon={Landmark} label="TVL on LitVM" value="$2.1M" color="text-green-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Flow chart */}
        <div className="analytics-card lg:col-span-2 rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Bridge Flow (14d)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={flowData}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="inflow" stroke="#6366f1" fill="rgba(99,102,241,0.15)" strokeWidth={2} />
              <Area type="monotone" dataKey="outflow" stroke="#ef4444" fill="rgba(239,68,68,0.1)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center text-xs text-white/50">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#6366f1]" /> Inflow</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#ef4444]" /> Outflow</span>
          </div>
        </div>

        {/* Sources pie */}
        <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Top Sources</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={sources} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} strokeWidth={0}>
                {sources.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-1.5 mt-2">
            {sources.map((s, i) => (
              <span key={i} className="flex items-center gap-1.5 text-xs text-white/60">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                {s.name} — {s.value}%
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Recent bridges */}
      <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Recent Bridges</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/5">
                <th className="text-left py-2 px-3">Tx Hash</th>
                <th className="text-left py-2 px-3">Source Chain</th>
                <th className="text-right py-2 px-3">Amount</th>
                <th className="text-right py-2 px-3">Time</th>
                <th className="text-right py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {bridges.map((b, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-2.5 px-3 font-mono text-xs text-[var(--accent)]">{b.hash}</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-white/60">{b.chain}</td>
                  <td className="py-2.5 px-3 font-mono text-white/80 text-right">{b.amount} {b.token}</td>
                  <td className="py-2.5 px-3 font-mono text-white/50 text-right">{b.time}</td>
                  <td className={`py-2.5 px-3 font-mono text-xs text-right ${b.status === 'Confirmed' ? 'text-green-400' : 'text-yellow-400'}`}>{b.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


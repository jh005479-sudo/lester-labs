'use client'

import { useState, useEffect } from 'react'
import { Fuel, Zap, TrendingUp, Clock, Activity } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { rpc } from '@/lib/rpcClient'

const DEMO_BADGE = (
  <span className="inline-block ml-2 text-[10px] uppercase tracking-wider text-yellow-400/70 border border-yellow-400/30 rounded px-1.5 py-0.5">demo data</span>
)

// Demo gas trend data — 24hr rolling history in Gwei
const gasTrendData = Array.from({ length: 24 }, (_, i) => {
  const hour = new Date()
  hour.setHours(hour.getHours() - (23 - i))
  const base = 18 + Math.sin(i * 0.4) * 6 + Math.random() * 4
  return {
    hour: hour.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    slow: Math.round(base * 0.6),
    standard: Math.round(base),
    fast: Math.round(base * 1.8),
  }
})

// Live gas tiers derived from current on-chain gas price
interface GasTiers {
  slow: number
  standard: number
  fast: number
  current: number
  unit: string
}

const StatCard = ({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string; sub?: string; color?: string }) => (
  <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
    <div className="flex items-center gap-2 mb-2">
      <Icon className={`h-4 w-4 ${color ?? 'text-[var(--accent)]'}`} />
      <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-2xl font-bold font-mono text-white">{value}</p>
    {sub && <span className="text-xs text-white/40 ml-1">{sub}</span>}
  </div>
)

export function GasAnalyticsPanel() {
  const [gasTiers, setGasTiers] = useState<GasTiers | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSpeed, setSelectedSpeed] = useState<'slow' | 'standard' | 'fast'>('standard')

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch current gas price from chain
        const hexGasPrice = await rpc<string>('eth_gasPrice', [])
        const gasPrice = parseInt(hexGasPrice, 16) // wei
        const gwei = parseFloat((gasPrice / 1e9).toFixed(2))

        // Derive tiers from current gas
        setGasTiers({
          slow: Math.round(gwei * 0.6),
          standard: gwei,
          fast: Math.round(gwei * 2.0),
          current: gwei,
          unit: 'Gwei',
        })
      } catch {
        // Fallback to demo values if RPC fails
        setGasTiers({
          slow: 11,
          standard: 18,
          fast: 36,
          current: 18,
          unit: 'Gwei',
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const speedColors = { slow: '#22c55e', standard: '#6366f1', fast: '#ef4444' }
  const speedLabels = { slow: 'Slow', standard: 'Standard', fast: 'Fast' }

  return (
    <div>
      <div className="flex items-center mb-6">
        <h2 className="text-xl font-bold text-white">Gas Analytics</h2>
        {DEMO_BADGE}
      </div>

      {/* Gas tier selector + current price */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        {/* Speed selector */}
        <div className="analytics-card lg:col-span-2 rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Gas Speed</h3>
          <div className="flex gap-3">
            {(['slow', 'standard', 'fast'] as const).map(speed => (
              <button
                key={speed}
                onClick={() => setSelectedSpeed(speed)}
                className="flex-1 py-3 px-4 rounded-lg border transition-all"
                style={{
                  background: selectedSpeed === speed ? `${speedColors[speed]}18` : 'transparent',
                  borderColor: selectedSpeed === speed ? speedColors[speed] : 'rgba(255,255,255,0.1)',
                  color: selectedSpeed === speed ? speedColors[speed] : 'rgba(255,255,255,0.4)',
                }}
              >
                <div className="text-lg font-bold font-mono">{gasTiers ? gasTiers[speed] : '—'}</div>
                <div className="text-xs mt-1 opacity-70">{speedLabels[speed]}</div>
              </button>
            ))}
          </div>
          {gasTiers && (
            <p className="text-xs text-white/40 mt-3">
              Estimated confirmation: {selectedSpeed === 'slow' ? '~5 min' : selectedSpeed === 'standard' ? '~30 sec' : '~5 sec'}
            </p>
          )}
        </div>

        {/* Current gas stat */}
        <StatCard
          icon={Fuel}
          label="Current Gas Price"
          value={gasTiers ? `${gasTiers.current} ${gasTiers.unit}` : '—'}
          color="text-[var(--accent)]"
        />
        <StatCard
          icon={Zap}
          label="Network Utilization"
          value={loading ? '—' : `${Math.round(62 + Math.random() * 20)}%`}
          color="text-yellow-400"
        />
      </div>

      {/* Gas trend chart */}
      <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5 mb-6">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--accent)]" /> 24h Gas Price Trend
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={gasTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradSlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradStandard" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradFast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="hour"
              tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={3}
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v}Gwei`}
            />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
            />
            <Area type="monotone" dataKey="slow" stroke="#22c55e" strokeWidth={1.5} fill="url(#gradSlow)" dot={false} name="Slow" />
            <Area type="monotone" dataKey="standard" stroke="#6366f1" strokeWidth={2} fill="url(#gradStandard)" dot={false} name="Standard" />
            <Area type="monotone" dataKey="fast" stroke="#ef4444" strokeWidth={1.5} fill="url(#gradFast)" dot={false} name="Fast" />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-3">
          <span className="flex items-center gap-1.5 text-xs text-white/50"><span className="w-2 h-2 rounded-full bg-green-500" /> Slow</span>
          <span className="flex items-center gap-1.5 text-xs text-white/50"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Standard</span>
          <span className="flex items-center gap-1.5 text-xs text-white/50"><span className="w-2 h-2 rounded-full bg-red-500" /> Fast</span>
        </div>
      </div>

      {/* Gas oracle info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" /> Last Block
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Block #</span>
              <span className="font-mono text-white">{loading ? '—' : Math.floor(18000000 + Math.random() * 100000)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Base Fee</span>
              <span className="font-mono text-white">{gasTiers ? `${gasTiers.standard} Gwei` : '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Gas Used</span>
              <span className="font-mono text-white">{loading ? '—' : `${Math.round(85 + Math.random() * 14)}%`}</span>
            </div>
          </div>
        </div>

        <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-400" /> Gas History (24h)
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Avg</span>
              <span className="font-mono text-white">{gasTiers ? `${Math.round(gasTiers.standard * 0.9)} Gwei` : '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Peak</span>
              <span className="font-mono text-red-400">{gasTiers ? `${Math.round(gasTiers.fast * 1.2)} Gwei` : '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Low</span>
              <span className="font-mono text-green-400">{gasTiers ? `${Math.round(gasTiers.slow * 0.8)} Gwei` : '—'}</span>
            </div>
          </div>
        </div>

        <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-400" /> Cost Estimator
          </h3>
          <div className="space-y-2">
            {[
              { label: 'ETH Transfer', gas: '21,000' },
              { label: 'ERC-20 Transfer', gas: '65,000' },
              { label: 'Swap (DEX)', gas: '150,000' },
              { label: 'Token Deploy', gas: '1,200,000' },
            ].map((tx, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-white/40">{tx.label}</span>
                <span className="font-mono text-white/70">{gasTiers ? `~${((parseInt(tx.gas) * gasTiers.standard) / 1e9).toFixed(4)} ETH` : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

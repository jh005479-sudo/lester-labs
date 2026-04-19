'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { formatUnits, parseUnits, zeroAddress } from 'viem'
import { UNISWAP_V2_FACTORY_ADDRESS, UNISWAP_V2_ROUTER_ADDRESS, WRAPPED_ZKLTC_ADDRESS, isValidContractAddress } from '@/config/contracts'
import { ERC20_ABI, UNISWAP_V2_FACTORY_ABI, UNISWAP_V2_PAIR_ABI } from '@/config/abis'
import { rpc } from '@/lib/rpcClient'

const ACCENT = '#E44FB5'
const ZERO_ADDR = zeroAddress as `0x${string}`
const CHAIN_ID = 4441

// ── Types ──────────────────────────────────────────────────────────────────

interface LPPosition {
  pairAddress: `0x${string}`
  token0: { address: `0x${string}`; symbol: string; decimals: number }
  token1: { address: `0x${string}`; symbol: string; decimals: number }
  lpBalance: bigint
  totalSupply: bigint
  reserve0: bigint
  reserve1: bigint
  poolShare: number // fraction 0–1
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTokenAmount(value: bigint, decimals: number): string {
  if (value === 0n) return '0'
  const raw = formatUnits(value, decimals)
  const [whole, fraction = ''] = raw.split('.')
  if (!fraction) return whole
  return `${whole}.${fraction.slice(0, 6).replace(/0+$/, '') || '0'}`
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(4)}%`
}

// Impermanent loss: IL = 1 - sqrt(price_ratio)
// price_ratio = current_price / initial_price
function calcIL(priceRatio: number): { ilPct: number; ilAbsolute: number; initialValue: number; currentValue: number } {
  const sqrtRatio = Math.sqrt(priceRatio)
  const ilPct = 1 - sqrtRatio // negative means loss, e.g. -0.05 = 5% loss
  const initialValue = 2 // assume $1 each = $2 initial for normalized calc
  const hodlValue = priceRatio > 0 ? initialValue * (1 + priceRatio) / 2 : 0
  const currentValue = initialValue * sqrtRatio
  const ilAbsolute = hodlValue - currentValue
  return { ilPct, ilAbsolute, initialValue, currentValue }
}

// ── IL Calculator ──────────────────────────────────────────────────────────

function ILCalculator({
  initial0,
  initial1,
  current0,
  current1,
}: {
  initial0: string
  initial1: string
  current0: string
  current1: string
}) {
  const n0 = parseFloat(initial0) || 0
  const n1 = parseFloat(initial1) || 0
  const c0 = parseFloat(current0) || 0
  const c1 = parseFloat(current1) || 0

  const initialValue = n0 + n1
  const currentValue = c0 + c1
  const priceRatio = initialValue > 0 ? currentValue / initialValue : 0
  const { ilPct } = calcIL(priceRatio)
  const ilAbsolute = initialValue - currentValue
  const pnl = currentValue - initialValue
  const pnlPct = initialValue > 0 ? pnl / initialValue : 0

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '14px',
        padding: '16px',
      }}
    >
      <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
        Impermanent Loss Calculator
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {[
          { label: 'Initial investment', value: initialValue > 0 ? `$${initialValue.toFixed(2)}` : '—' },
          { label: 'Current value', value: currentValue > 0 ? `$${currentValue.toFixed(2)}` : '—' },
          { label: 'PnL', value: pnl !== 0 && initialValue > 0 ? `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${(pnlPct * 100).toFixed(2)}%)` : '—' },
          { label: 'Impermanent loss', value: ilPct !== 0 ? `${(ilPct * 100).toFixed(4)}%` : '—' },
          { label: 'IL absolute', value: ilAbsolute !== 0 ? `-$${Math.abs(ilAbsolute).toFixed(2)}` : '—' },
          { label: 'Price ratio', value: priceRatio > 0 ? priceRatio.toFixed(4) : '—' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px' }}>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '3px' }}>{label}</p>
            <p style={{ fontSize: '13px', fontWeight: 600, color: ilAbsolute > 0 && label === 'IL absolute' ? '#EF4444' : '#fff' }}>{value}</p>
          </div>
        ))}
      </div>

      <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '10px' }}>
        IL formula: 1 − √(price_ratio). This is an estimate — fees are excluded.
      </p>
    </div>
  )
}

// ── LP Position Card ───────────────────────────────────────────────────────

function LPPositionCard({ position }: { position: LPPosition }) {
  const lpTokenAddr = position.pairAddress
  const lpDecimals = 18

  // Read LP token metadata
  const lpNameRead = useReadContract({ address: lpTokenAddr, abi: ERC20_ABI, functionName: 'name' })
  const lpSymbolRead = useReadContract({ address: lpTokenAddr, abi: ERC20_ABI, functionName: 'symbol' })

  const lpName = (lpNameRead.data as string) || 'Liquidity Pool'
  const lpSymbol = (lpSymbolRead.data as string) || 'LP'

  const lpValue = position.lpBalance === 0n ? 0 : Number(formatUnits(position.lpBalance, lpDecimals))
  const totalSupply = position.totalSupply
  const poolShare = totalSupply > 0n ? Number(position.lpBalance) / Number(totalSupply) : 0

  // Value of underlying tokens
  const reserve0PerLp = totalSupply > 0n ? Number(position.reserve0) / Number(totalSupply) : 0
  const reserve1PerLp = totalSupply > 0n ? Number(position.reserve1) / Number(totalSupply) : 0
  const val0 = lpValue * reserve0PerLp
  const val1 = lpValue * reserve1PerLp

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '18px 20px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>
            {position.token0.symbol} / {position.token1.symbol}
          </p>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
            {lpName} ({lpSymbol})
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '2px' }}>Pool share</p>
          <p style={{ fontSize: '15px', fontWeight: 700, color: ACCENT }}>{formatPct(poolShare)}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        {[
          {
            label: `${position.token0.symbol} balance`,
            value: formatTokenAmount(position.lpBalance, lpDecimals),
            sub: `${val0.toFixed(4)} ${position.token0.symbol}`,
          },
          {
            label: `${position.token1.symbol} balance`,
            value: formatTokenAmount(position.lpBalance, lpDecimals),
            sub: `${val1.toFixed(4)} ${position.token1.symbol}`,
          },
        ].map(({ label, value, sub }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px 12px' }}>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>{label}</p>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{value}</p>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{sub}</p>
          </div>
        ))}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px 12px' }}>
        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>Pair address</p>
        <p style={{ fontFamily: 'monospace', fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{position.pairAddress}</p>
      </div>
    </div>
  )
}

// ── LP Scanner ─────────────────────────────────────────────────────────────

async function scanLPPositions(wallet: `0x${string}`): Promise<LPPosition[]> {
  if (!isValidContractAddress(UNISWAP_V2_FACTORY_ADDRESS)) return []

  // Get all pair count
  let pairCount = 0
  try {
    const countHex = await rpc<`0x${string}`>('eth_call', [{
      to: UNISWAP_V2_FACTORY_ADDRESS,
      data: '0x4f833a74' // allPairsLength()
    }, 'latest'])
    pairCount = parseInt(countHex, 16)
  } catch {
    return []
  }

  if (pairCount === 0 || pairCount > 1000) return []

  // Batch fetch pair addresses (chunk in groups of 20)
  const pairAddresses: `0x${string}`[] = []
  for (let i = 0; i < pairCount; i += 20) {
    const batchHex = await rpc<`0x${string}`>('eth_call', [{
      to: UNISWAP_V2_FACTORY_ADDRESS,
      data: '0x1c2c7c' + BigInt(i).toString(16).padStart(64, '0') // allPairs(i) — 4-byte selector
    }, 'latest'])
    // This is a single call — actually we need allPairs(i) for each i individually
    // Since allPairs returns a single address, we need to batch eth_calls
  }

  // Fetch pair addresses one by one for simplicity (pairCount is bounded)
  const allPairsCalls = Array.from({ length: Math.min(pairCount, 500) }, (_, i) => ({
    to: UNISWAP_V2_FACTORY_ADDRESS,
    data: '0x1c2c7c' + BigInt(i).toString(16).padStart(64, '0'),
  }))

  // Use multicall-ish pattern: batch eth_call requests
  const batchSize = 50
  const allPairAddrs: `0x${string}`[] = []
  for (let b = 0; b < allPairsCalls.length; b += batchSize) {
    const batch = allPairsCalls.slice(b, b + batchSize)
    const results = await Promise.allSettled(
      batch.map(call =>
        rpc<`0x${string}`>('eth_call', [{ to: call.to, data: call.data }, 'latest'], { cacheKey: `pair:${call.data}`, cacheTtl: 30_000 })
      )
    )
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value && r.value !== ZERO_ADDR) {
        allPairAddrs.push(r.value as `0x${string}`)
      }
    }
  }

  // For each pair, check wallet's LP balance
  const positions: LPPosition[] = []

  for (const pairAddr of allPairAddrs) {
    try {
      // balanceOf
      const balanceHex = await rpc<`0x${string}`>('eth_call', [{
        to: pairAddr,
        data: '0x70a08231' + wallet.slice(2).padStart(64, '0') // balanceOf(owner)
      }, 'latest'], { cacheKey: `lpbal:${pairAddr}:${wallet}`, cacheTtl: 15_000 })

      const lpBalance = BigInt(balanceHex)
      if (lpBalance === 0n) continue

      // Get token0, token1, reserves, totalSupply in one batch
      const [token0Hex, token1Hex, reservesHex, totalSupplyHex] = await Promise.all([
        rpc<`0x${string}`>('eth_call', [{ to: pairAddr, data: '0x0dfe1681' }, 'latest'], { cacheKey: `t0:${pairAddr}`, cacheTtl: 30_000 }),
        rpc<`0x${string}`>('eth_call', [{ to: pairAddr, data: '0xd21220a7' }, 'latest'], { cacheKey: `t1:${pairAddr}`, cacheTtl: 30_000 }),
        rpc<`0x${string}`>('eth_call', [{ to: pairAddr, data: '0x0902f13c' }, 'latest'], { cacheKey: `res:${pairAddr}`, cacheTtl: 15_000 }),
        rpc<`0x${string}`>('eth_call', [{ to: pairAddr, data: '0x18160ddd' }, 'latest'], { cacheKey: `ts:${pairAddr}`, cacheTtl: 30_000 }),
      ])

      const token0 = token0Hex as `0x${string}`
      const token1 = token1Hex as `0x${string}`
      const totalSupply = BigInt(totalSupplyHex)

      // Decode reserves (3 x 112-bit)
      const r0 = BigInt('0x' + reservesHex.slice(2, 26))
      const r1 = BigInt('0x' + reservesHex.slice(66, 90))

      // Fetch token symbols
      const [sym0, sym1, dec0, dec1] = await Promise.all([
        rpc<string>('eth_call', [{ to: token0, data: '0x06fdde03' }, 'latest']).catch(() => '?'),
        rpc<string>('eth_call', [{ to: token1, data: '0x06fdde03' }, 'latest']).catch(() => '?'),
        rpc<string>('eth_call', [{ to: token0, data: '0x95d89b41' }, 'latest']).catch(() => '18'),
        rpc<string>('eth_call', [{ to: token1, data: '0x95d89b41' }, 'latest']).catch(() => '18'),
      ])

      positions.push({
        pairAddress: pairAddr,
        token0: { address: token0, symbol: sym0 === '0x' ? '?' : sym0, decimals: 18 },
        token1: { address: token1, symbol: sym1 === '0x' ? '?' : sym1, decimals: 18 },
        lpBalance,
        totalSupply,
        reserve0: r0,
        reserve1: r1,
        poolShare: Number(lpBalance) / Number(totalSupply),
      })
    } catch {
      // Skip pairs that fail
    }
  }

  return positions
}

// ── PnL Calculator ─────────────────────────────────────────────────────────

function PnLCalculator() {
  const [initialInvestment, setInitialInvestment] = useState('')
  const [initial0, setInitial0] = useState('')
  const [initial1, setInitial1] = useState('')
  const [current0, setCurrent0] = useState('')
  const [current1, setCurrent1] = useState('')
  const [calcMode, setCalcMode] = useState<'simple' | 'detailed'>('simple')

  const n0 = parseFloat(initial0) || 0
  const n1 = parseFloat(initial1) || 0
  const c0 = parseFloat(current0) || 0
  const c1 = parseFloat(current1) || 0

  const initialValue = n0 + n1
  const currentValue = c0 + c1
  const pnl = currentValue - initialValue
  const pnlPct = initialValue > 0 ? pnl / initialValue : 0
  const priceRatio = initialValue > 0 ? currentValue / initialValue : 0
  const { ilPct, ilAbsolute } = calcIL(priceRatio)

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '14px',
        padding: '16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)' }}>
          PnL Calculator
        </p>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['simple', 'detailed'] as const).map(m => (
            <button
              key={m}
              onClick={() => setCalcMode(m)}
              style={{
                padding: '3px 10px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer',
                background: calcMode === m ? `${ACCENT}33` : 'rgba(255,255,255,0.06)',
                color: calcMode === m ? '#fff' : 'rgba(255,255,255,0.4)',
              }}
            >
              {m === 'simple' ? 'Simple' : 'Detailed'}
            </button>
          ))}
        </div>
      </div>

      {calcMode === 'simple' ? (
        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px 14px' }}>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>Initial investment (USD)</p>
            <input
              value={initialInvestment}
              onChange={e => setInitialInvestment(e.target.value)}
              placeholder="e.g. 1000"
              type="number"
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '16px',
                fontWeight: 700,
                color: '#fff',
              }}
            />
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px 14px' }}>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>Current position value (USD)</p>
            <input
              value={currentValue > 0 ? currentValue.toFixed(2) : ''}
              onChange={e => {
                const v = parseFloat(e.target.value) || 0
                setCurrent0((v / 2).toFixed(4))
                setCurrent1((v / 2).toFixed(4))
              }}
              placeholder="e.g. 1200"
              type="number"
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '16px',
                fontWeight: 700,
                color: '#fff',
              }}
            />
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px 14px' }}>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>Token A initial ($)</p>
            <input value={initial0} onChange={e => setInitial0(e.target.value)} placeholder="0.0" type="number"
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, color: '#fff' }} />
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px 14px' }}>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>Token B initial ($)</p>
            <input value={initial1} onChange={e => setInitial1(e.target.value)} placeholder="0.0" type="number"
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, color: '#fff' }} />
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px 14px' }}>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>Token A now ($)</p>
            <input value={current0} onChange={e => setCurrent0(e.target.value)} placeholder="0.0" type="number"
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, color: '#fff' }} />
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px 14px' }}>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>Token B now ($)</p>
            <input value={current1} onChange={e => setCurrent1(e.target.value)} placeholder="0.0" type="number"
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, color: '#fff' }} />
          </div>
        </div>
      )}

      {(initialValue > 0 || parseFloat(initialInvestment) > 0) && (
        <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {[
            {
              label: 'Total PnL',
              value: initialValue > 0 && pnl !== 0
                ? `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${(pnlPct * 100).toFixed(2)}%)`
                : parseFloat(initialInvestment) > 0 && currentValue > 0
                  ? `${currentValue >= parseFloat(initialInvestment) ? '+' : ''}$${(currentValue - parseFloat(initialInvestment)).toFixed(2)}`
                  : '—',
              color: pnl >= 0 ? '#34D399' : '#EF4444',
            },
            {
              label: 'Impermanent loss',
              value: priceRatio > 0 ? `${(ilPct * 100).toFixed(4)}%` : '—',
              color: '#EF4444',
            },
            {
              label: 'IL absolute',
              value: priceRatio > 0 ? `-$${Math.abs(ilAbsolute).toFixed(2)}` : '—',
              color: '#EF4444',
            },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px' }}>
              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '3px' }}>{label}</p>
              <p style={{ fontSize: '13px', fontWeight: 600, color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '10px' }}>
        Requires price oracle for full accuracy — showing reserve-based estimate. Fees excluded.
      </p>
    </div>
  )
}

// ── Loading Skeleton ───────────────────────────────────────────────────────

function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 120,
            borderRadius: 16,
            background: 'rgba(255,255,255,0.03)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  )
}

// ── Main LPPanel ───────────────────────────────────────────────────────────

export function LPPanel() {
  const { address } = useAccount()
  const [positions, setPositions] = useState<LPPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [showILCalc, setShowILCalc] = useState(false)

  // IL standalone calculator state
  const [ilInitial0, setIlInitial0] = useState('')
  const [ilInitial1, setIlInitial1] = useState('')
  const [ilCurrent0, setIlCurrent0] = useState('')
  const [ilCurrent1, setIlCurrent1] = useState('')

  useEffect(() => {
    if (!address) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    scanLPPositions(address).then(pos => {
      if (!cancelled) {
        setPositions(pos)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [address])

  const totalPositions = positions.length

  return (
    <div className="space-y-6">
      {/* Scan header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
            {loading
              ? 'Scanning factory pairs…'
              : totalPositions === 0
                ? 'No LP positions found'
                : `${totalPositions} LP position${totalPositions !== 1 ? 's' : ''} found`}
          </p>
        </div>
        <button
          onClick={() => setShowILCalc(v => !v)}
          style={{
            padding: '6px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: showILCalc ? `${ACCENT}22` : 'rgba(255,255,255,0.04)',
            color: showILCalc ? '#fff' : 'rgba(255,255,255,0.5)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showILCalc ? 'Hide IL calc' : 'IL Calculator'}
        </button>
      </div>

      {/* Standalone IL Calculator */}
      {showILCalc && (
        <div className="space-y-4">
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '14px',
              padding: '16px',
            }}
          >
            <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
              Impermanent Loss Calculator
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px 14px' }}>
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>Token A price at deposit ($)</p>
                <input value={ilInitial0} onChange={e => setIlInitial0(e.target.value)} placeholder="0.0" type="number"
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, color: '#fff' }} />
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px 14px' }}>
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>Token B price at deposit ($)</p>
                <input value={ilInitial1} onChange={e => setIlInitial1(e.target.value)} placeholder="0.0" type="number"
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, color: '#fff' }} />
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px 14px' }}>
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>Token A price now ($)</p>
                <input value={ilCurrent0} onChange={e => setIlCurrent0(e.target.value)} placeholder="0.0" type="number"
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, color: '#fff' }} />
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px 14px' }}>
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>Token B price now ($)</p>
                <input value={ilCurrent1} onChange={e => setIlCurrent1(e.target.value)} placeholder="0.0" type="number"
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, color: '#fff' }} />
              </div>
            </div>
            <ILCalculator initial0={ilInitial0} initial1={ilInitial1} current0={ilCurrent0} current1={ilCurrent1} />
          </div>
        </div>
      )}

      {/* PnL Calculator */}
      <PnLCalculator />

      {/* LP Positions */}
      {loading && <LoadingSkeleton />}

      {!loading && positions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px' }}>No liquidity pool positions detected.</p>
          <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '12px', marginTop: '6px' }}>
            Add liquidity on the Pool page to see your positions here.
          </p>
        </div>
      )}

      {!loading && positions.length > 0 && (
        <div className="space-y-3">
          {positions.map(pos => (
            <LPPositionCard key={pos.pairAddress} position={pos} />
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { ILO_FACTORY_ADDRESS } from '@/config/contracts'
import { ILO_FACTORY_ABI } from '@/config/abis'

type Tab = 'browse' | 'create'

const COLOR = '#5E6AD2'
const COLOR_RGB = '94,106,210'
const FACTS: [string, string][] = [
  ['Fee', '2% of raise'],
  ['LP', 'Auto-created'],
  ['DEX', 'LitVM Native'],
  ['Access', 'Open'],
]

// TODO: Replace with live contract reads once ILOFactory is deployed
const MOCK_PRESALES = [
  {
    address: '0x0000000000000000000000000000000000000001',
    name: 'DemoToken',
    symbol: 'DEMO',
    softCap: '10',
    hardCap: '50',
    raised: '23.4',
    startTime: Date.now() - 86400000,
    endTime: Date.now() + 5 * 86400000,
    finalized: false,
    cancelled: false,
    liquidityBps: 6000,
    lpLockDuration: 180 * 86400,
    contributorCount: 47,
  },
]

type MockPresale = (typeof MOCK_PRESALES)[0]

function CreatePresaleForm() {
  const { isConnected } = useAccount()
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const [form, setForm] = useState({
    tokenAddress: '',
    softCap: '',
    hardCap: '',
    tokensPerEth: '',
    startDate: '',
    endDate: '',
    liquidityPct: '60',
    lpLockDays: '180',
    whitelist: false,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value =
        e.target.type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : e.target.value
      setForm((f) => ({ ...f, [k]: value }))
    }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.tokenAddress || !/^0x[0-9a-fA-F]{40}$/.test(form.tokenAddress)) {
      errs.tokenAddress = 'Enter a valid token address (0x...)'
    }
    if (!form.softCap || isNaN(parseFloat(form.softCap)) || parseFloat(form.softCap) <= 0) {
      errs.softCap = 'Soft cap must be greater than 0'
    }
    if (!form.hardCap || isNaN(parseFloat(form.hardCap)) || parseFloat(form.hardCap) <= 0) {
      errs.hardCap = 'Hard cap must be greater than 0'
    }
    if (parseFloat(form.hardCap) < parseFloat(form.softCap)) {
      errs.hardCap = 'Hard cap must be ≥ soft cap'
    }
    if (!form.tokensPerEth || isNaN(parseFloat(form.tokensPerEth)) || parseFloat(form.tokensPerEth) <= 0) {
      errs.tokensPerEth = 'Enter how many tokens 1 LTC buys'
    }
    if (!form.startDate) {
      errs.startDate = 'Select a start date'
    } else if (new Date(form.startDate).getTime() < Date.now()) {
      errs.startDate = 'Start date must be in the future'
    }
    if (!form.endDate) {
      errs.endDate = 'Select an end date'
    } else if (form.startDate && new Date(form.endDate) <= new Date(form.startDate)) {
      errs.endDate = 'End date must be after start date'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const errorStyle: React.CSSProperties = { fontSize: '11px', color: '#f87171', marginTop: '4px' }

  const handleCreate = async () => {
    if (!isConnected) return
    if (!validate()) return
    const startTs = Math.floor(new Date(form.startDate).getTime() / 1000)
    const endTs = Math.floor(new Date(form.endDate).getTime() / 1000)
    writeContract({
      address: ILO_FACTORY_ADDRESS,
      abi: ILO_FACTORY_ABI,
      functionName: 'createILO',
      args: [
        form.tokenAddress as `0x${string}`,
        parseEther(form.softCap || '0'),
        parseEther(form.hardCap || '0'),
        parseEther(form.tokensPerEth || '0'),
        BigInt(startTs),
        BigInt(endTs),
        BigInt(Math.floor(parseFloat(form.liquidityPct) * 100)),
        BigInt(parseInt(form.lpLockDays) * 86400),
        form.whitelist,
      ],
      value: parseEther('0.03'),
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    background: 'var(--muted, #111)',
    border: '1px solid var(--border, #1a1a1a)',
    borderRadius: '8px', color: 'var(--foreground, #fff)',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)',
    marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em',
  }

  return (
    <div>
      <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Create Presale</h2>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '28px' }}>
          Launch a community presale. LP is automatically created on SparkDex and locked for your chosen duration.
        </p>
        <div style={{ display: 'grid', gap: '20px' }}>
          <div>
            <label style={labelStyle}>Token Address</label>
            <input style={inputStyle} placeholder="0x..." value={form.tokenAddress} onChange={set('tokenAddress')} />
            {errors.tokenAddress && <div style={errorStyle}>{errors.tokenAddress}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Soft Cap (LTC)</label>
              <input style={inputStyle} type="number" placeholder="10" value={form.softCap} onChange={set('softCap')} />
              {errors.softCap && <div style={errorStyle}>{errors.softCap}</div>}
            </div>
            <div>
              <label style={labelStyle}>Hard Cap (LTC)</label>
              <input style={inputStyle} type="number" placeholder="50" value={form.hardCap} onChange={set('hardCap')} />
              {errors.hardCap && <div style={errorStyle}>{errors.hardCap}</div>}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Tokens per LTC</label>
            <input style={inputStyle} type="number" placeholder="1000000" value={form.tokensPerEth} onChange={set('tokensPerEth')} />
            {errors.tokensPerEth && <div style={errorStyle}>{errors.tokensPerEth}</div>}
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>e.g. 1,000,000 means contributors get 1M tokens per 1 LTC raised</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input style={inputStyle} type="datetime-local" value={form.startDate} onChange={set('startDate')} />
              {errors.startDate && <div style={errorStyle}>{errors.startDate}</div>}
            </div>
            <div>
              <label style={labelStyle}>End Date</label>
              <input style={inputStyle} type="datetime-local" value={form.endDate} onChange={set('endDate')} />
              {errors.endDate && <div style={errorStyle}>{errors.endDate}</div>}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Liquidity Allocation — {form.liquidityPct}%</label>
            <input style={{ ...inputStyle, padding: '6px 14px' }} type="range" min="50" max="100" step="5" value={form.liquidityPct} onChange={set('liquidityPct')} />
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>% of raised LTC that goes to SparkDex LP. Minimum 50%.</p>
          </div>
          <div>
            <label style={labelStyle}>LP Lock Duration</label>
            <select style={inputStyle} value={form.lpLockDays} onChange={set('lpLockDays')}>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days (recommended)</option>
              <option value="365">1 year</option>
              <option value="730">2 years</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input id="wl" type="checkbox" checked={form.whitelist} onChange={set('whitelist')} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
            <label htmlFor="wl" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>Enable whitelist (you control who can contribute)</label>
          </div>
          <div style={{ padding: '14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
            Creation fee: <strong style={{ color: 'rgba(255,255,255,0.9)' }}>0.03 LTC</strong> · Platform fee: <strong style={{ color: 'rgba(255,255,255,0.9)' }}>2% of raise</strong> at finalization
          </div>
          <button
            onClick={handleCreate}
            disabled={!isConnected || isPending || isConfirming}
            style={{
              padding: '14px', background: !isConnected || isPending || isConfirming ? 'rgba(99,102,241,0.3)' : 'var(--accent)',
              border: 'none', borderRadius: '8px', color: '#fff', fontSize: '15px', fontWeight: 600,
              cursor: !isConnected || isPending || isConfirming ? 'not-allowed' : 'pointer', transition: 'opacity 0.2s',
            }}
          >
            {!isConnected ? 'Connect Wallet' : isPending ? 'Confirm in wallet…' : isConfirming ? 'Creating presale…' : 'Create Presale — 0.03 LTC'}
          </button>
          {isSuccess && (
            <div style={{ padding: '16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', fontSize: '14px', color: '#4ade80' }}>
              <div style={{ fontWeight: 700, marginBottom: '10px' }}>✓ Presale created successfully!</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8 }}>
                <strong style={{ color: 'rgba(255,255,255,0.9)' }}>Next steps:</strong><br />
                1. Find your new presale contract address in the transaction receipt<br />
                2. Transfer your tokens to the presale contract address — use the <code>tokensRequired()</code> view function to get the exact amount needed<br />
                3. Share your presale link with your community once tokens are deposited
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PresaleCard({ presale }: { presale: MockPresale }) {
  const progress = (parseFloat(presale.raised) / parseFloat(presale.hardCap)) * 100
  const timeLeft = presale.endTime - Date.now()
  const daysLeft = Math.max(0, Math.floor(timeLeft / 86400000))
  const hoursLeft = Math.max(0, Math.floor((timeLeft % 86400000) / 3600000))
  const status = presale.finalized ? 'Finalized' : presale.cancelled ? 'Cancelled' : timeLeft > 0 ? 'Live' : 'Ended'
  const statusColor = status === 'Live' ? '#4ade80' : status === 'Finalized' ? '#818cf8' : '#f87171'

  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>{presale.name}</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>${presale.symbol}</div>
        </div>
        <span style={{ padding: '4px 10px', background: `${statusColor}22`, border: `1px solid ${statusColor}55`, borderRadius: '20px', fontSize: '12px', color: statusColor, fontWeight: 600 }}>● {status}</span>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>Raised</span>
          <span><strong style={{ color: 'var(--foreground)' }}>{presale.raised} LTC</strong> / {presale.hardCap} LTC</span>
        </div>
        <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, progress)}%`, background: 'var(--accent)', borderRadius: '3px', transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>Soft cap: {presale.softCap} LTC · {presale.contributorCount} contributors</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
        {([['Time left', status === 'Live' ? `${daysLeft}d ${hoursLeft}h` : '—'],['Liquidity', `${presale.liquidityBps / 100}% locked`],['LP lock', `${Math.round(presale.lpLockDuration / 86400)}d`],['DEX', 'SparkDex']] as [string, string][]).map(([k, v]) => (
          <div key={k}>
            <div style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>{k}</div>
            <div style={{ color: 'var(--foreground)', fontWeight: 500 }}>{v}</div>
          </div>
        ))}
      </div>
      <Link href={`/launchpad/${presale.address}`} style={{ display: 'block', padding: '10px', background: 'transparent', border: '1px solid var(--accent)', borderRadius: '8px', color: 'var(--accent)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>
        View Presale →
      </Link>
    </div>
  )
}

export default function LaunchpadPage() {
  const [tab, setTab] = useState<Tab>('browse')
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    const onMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      const y = (e.clientY - rect.top) / rect.height
      card.style.animation = 'none'
      card.style.transform = `perspective(600px) rotateX(${(y - 0.5) * -8}deg) rotateY(${(x - 0.5) * 8}deg) translateY(-4px)`
    }
    const onLeave = () => {
      card.style.transform = ''
      card.style.animation = 'cardFloat 6s ease-in-out infinite'
    }
    card.addEventListener('mousemove', onMove)
    card.addEventListener('mouseleave', onLeave)
    return () => { card.removeEventListener('mousemove', onMove); card.removeEventListener('mouseleave', onLeave) }
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#0a0818', color: '#f0eef5' }}>
      <Navbar />

      {/* HERO */}
      <div className="tool-hero">
        <div className="tool-hero-bg">
          <div className="tool-hero-glow" style={{ background: `radial-gradient(ellipse,rgba(${COLOR_RGB},.06) 0%,transparent 70%)` }} />
          <div className="tool-hero-glow-2" />
          <div className="tool-hero-grid" />
        </div>
        <div className="tool-hero-inner">
          <div style={{ maxWidth: 480 }}>
            <div className="tool-badge fade-up d1" style={{ background: `rgba(${COLOR_RGB},.08)`, border: `1px solid rgba(${COLOR_RGB},.15)`, color: COLOR }}>
              <div className="tool-badge-dot" style={{ background: COLOR }} />
              Presale Platform
            </div>
            <h1 className="tool-hero-title fade-up d2">
              <span className="white">Lester </span>
              <span className="accent" style={{ backgroundImage: `linear-gradient(135deg,${COLOR},#E44FB5)` }}>Launch</span>
            </h1>
            <p className="tool-hero-desc fade-up d3">Community presales with automatic LP creation on LitVM&apos;s native dex. Self-service, permissionless, contract-enforced.</p>
            <div className="tool-hero-stats fade-up d4">
              {[['LP','Auto-created'],['DEX','LitVM Native'],['Access','Open'],['Fee','2%']].map(([l,v]) => (
                <div key={l} style={{ display:'flex',flexDirection:'column',gap:2 }}>
                  <div className="tool-stat-label">{l}</div>
                  <div className="tool-stat-value">{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div ref={cardRef} className="tool-illus-card fade-up d3" style={{ borderColor: `rgba(${COLOR_RGB},.12)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/carousel/launchpad.png" alt="Lester Launch" />
            <div className="tool-illus-glow" style={{ background: `radial-gradient(ellipse at 50% 100%,rgba(${COLOR_RGB},.2) 0%,transparent 60%)` }} />
          </div>
        </div>
      </div>

      <div style={{ padding: '0 clamp(16px,4vw,40px)' }}>
        <div className="tool-section-divide" />
      </div>

      {/* WORKSPACE */}
      <div className="tool-workspace-wrap">
        <div className="tool-ws-bg">
          <div className="tool-ws-glow-1" style={{ background: `radial-gradient(circle,rgba(${COLOR_RGB},.04) 0%,transparent 70%)` }} />
          <div className="tool-ws-glow-2" />
          <div className="tool-ws-glow-3" />
          <div className="tool-ws-scanline" />
        </div>
        <div className="tool-workspace">
          {/* Left: all presale content */}
          <div>
            {/* Stats bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden', marginBottom: '40px' }}>
              {([['Total Presales', '— (live at testnet)'],['Total Raised', '— (live at testnet)'],['Platform Fee', '2% of raise']] as [string, string][]).map(([label, value]) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.025)', padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>{value}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', marginBottom: '32px' }}>
              {(['browse', 'create'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{ flex: 1, padding: '10px 20px', background: tab === t ? COLOR : 'transparent', border: 'none', borderRadius: '9px', color: tab === t ? '#fff' : 'rgba(240,238,245,0.45)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  {t === 'browse' ? '📡 Browse Presales' : '🚀 Create Presale'}
                </button>
              ))}
            </div>

            {/* Content */}
            {tab === 'browse' ? (
              <div>
                {MOCK_PRESALES.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '80px 20px', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: '40px', marginBottom: '16px' }}>🌑</div>
                    <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No active presales</div>
                    <div style={{ fontSize: '14px' }}>Be the first to launch on LitVM</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                    {MOCK_PRESALES.map((p) => (<PresaleCard key={p.address} presale={p} />))}
                  </div>
                )}
              </div>
            ) : (
              <CreatePresaleForm />
            )}
          </div>

          {/* Right: info card */}
          <div className="tool-preview">
            <div className="tool-preview-card">
              <div className="tool-preview-header">
                <div className="tool-preview-dot" style={{ background: COLOR, boxShadow: `0 0 6px ${COLOR}` }} />
                <div className="tool-preview-label">About This Tool</div>
              </div>
              <div className="tool-preview-body">
                <div style={{ borderRadius:16, overflow:'hidden', marginBottom:20, border:`1px solid rgba(${COLOR_RGB},.1)` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/carousel/launchpad.png" alt="Lester Launch" style={{ width:'100%', display:'block', objectFit:'cover', height:160 }} />
                </div>
                {FACTS.map(([k,v]) => (
                  <div key={k} className="tool-preview-stat">
                    <span className="tool-preview-stat-k">{k}</span>
                    <span className="tool-preview-stat-v">{v}</span>
                  </div>
                ))}
                <div className="tool-preview-network">
                  <div className="tool-preview-net-dot" />
                  <span className="tool-preview-net-text">Network</span>
                  <span className="tool-preview-net-name">LitVM Testnet</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { ToolHero } from '@/components/shared/ToolHero'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { parseEther, parseUnits, isAddress, formatEther } from 'viem'
import { ILO_FACTORY_ADDRESS, isValidContractAddress } from '@/config/contracts'
import { ILO_FACTORY_ABI } from '@/config/abis'

// ABI for fetching token decimals (RP-001)
const ERC20_DECIMALS_ABI = [
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const

type Tab = 'browse' | 'create'

// TODO: Replace with live contract reads once ILOFactory is deployed
// This data is for UI demonstration only — testnet placeholder
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
  const [tokenDecimals, setTokenDecimals] = useState<number | undefined>(undefined)

  // Fetch token decimals on-chain (RP-001)
  const { data: fetchedDecimals, isLoading: isDecimalsLoading, isError: isDecimalsError } = useReadContract({
    address: isAddress(form.tokenAddress) ? (form.tokenAddress as `0x${string}`) : undefined,
    abi: ERC20_DECIMALS_ABI,
    functionName: 'decimals',
    query: {
      enabled: isAddress(form.tokenAddress),
    },
  })

  // Reset decimals when token address changes to prevent stale values
  useEffect(() => {
    setTokenDecimals(undefined)
  }, [form.tokenAddress])

  // Update tokenDecimals when fetched
  useEffect(() => {
    if (fetchedDecimals !== undefined) {
      setTokenDecimals(fetchedDecimals)
    }
  }, [fetchedDecimals])

  // Fetch creation fee from contract (RP-003)
  const { data: creationFee, isLoading: isFeeLoading } = useReadContract({
    address: ILO_FACTORY_ADDRESS,
    abi: ILO_FACTORY_ABI,
    functionName: 'creationFee',
    query: {
      enabled: isValidContractAddress(ILO_FACTORY_ADDRESS),
    },
  })

  const feeDisplay = creationFee ? formatEther(creationFee) : '...'

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

  const errorStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#f87171',
    marginTop: '4px',
  }

  const iloFactoryValid = isValidContractAddress(ILO_FACTORY_ADDRESS)

  // Gate submit on successful decimals fetch (RP-001)
  const decimalsReady = tokenDecimals !== undefined && !isDecimalsError
  const feeReady = creationFee !== undefined && !isFeeLoading

  const handleCreate = async () => {
    if (!isConnected) return
    if (!iloFactoryValid) return
    if (!validate()) return
    if (!decimalsReady || !feeReady) return // Block if decimals/fee not loaded (RP-001, RP-003)
    const startTs = Math.floor(new Date(form.startDate).getTime() / 1000)
    const endTs = Math.floor(new Date(form.endDate).getTime() / 1000)
    writeContract({
      address: ILO_FACTORY_ADDRESS,
      abi: ILO_FACTORY_ABI,
      functionName: 'createILO',
      args: [
        form.tokenAddress as `0x${string}`,
        parseEther(form.softCap || '0'), // native asset units
        parseEther(form.hardCap || '0'),  // native asset units
        parseUnits(form.tokensPerEth || '0', tokenDecimals!), // Use token decimals (RP-001)
        BigInt(startTs),
        BigInt(endTs),
        BigInt(Math.floor(parseFloat(form.liquidityPct) * 100)),
        BigInt(parseInt(form.lpLockDays) * 86400),
        form.whitelist,
      ],
      value: creationFee!, // Use live fee from contract (RP-003)
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--muted, #111)',
    border: '1px solid var(--border, #1a1a1a)',
    borderRadius: '8px',
    color: 'var(--foreground, #fff)',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div
        style={{
          background: 'var(--surface-1)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '12px',
          padding: '32px',
        }}
      >
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
          Create Presale
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '28px',
          }}
        >
          Launch a community presale. LP is automatically created on SparkDex
          and locked for your chosen duration.
        </p>

        <div style={{ display: 'grid', gap: '20px' }}>
          {/* Token Address */}
          <div>
            <label style={labelStyle}>Token Address</label>
            <input
              style={inputStyle}
              placeholder="0x..."
              value={form.tokenAddress}
              onChange={set('tokenAddress')}
            />
            {errors.tokenAddress && <div style={errorStyle}>{errors.tokenAddress}</div>}
          </div>

          {/* Caps */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
            }}
          >
            <div>
              <label style={labelStyle}>Soft Cap (LTC)</label>
              <input
                style={inputStyle}
                type="number"
                placeholder="10"
                value={form.softCap}
                onChange={set('softCap')}
              />
              {errors.softCap && <div style={errorStyle}>{errors.softCap}</div>}
            </div>
            <div>
              <label style={labelStyle}>Hard Cap (LTC)</label>
              <input
                style={inputStyle}
                type="number"
                placeholder="50"
                value={form.hardCap}
                onChange={set('hardCap')}
              />
              {errors.hardCap && <div style={errorStyle}>{errors.hardCap}</div>}
            </div>
          </div>

          {/* Price */}
          <div>
            <label style={labelStyle}>Tokens per LTC</label>
            <input
              style={inputStyle}
              type="number"
              placeholder="1000000"
              value={form.tokensPerEth}
              onChange={set('tokensPerEth')}
            />
            {errors.tokensPerEth && <div style={errorStyle}>{errors.tokensPerEth}</div>}
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
              e.g. 1,000,000 means contributors get 1M tokens per 1 LTC raised
            </p>
            {/* RP-001: Token decimals UI note */}
            {isAddress(form.tokenAddress) && (
              <p style={{ fontSize: '11px', color: isDecimalsError ? '#f87171' : 'rgba(99,102,241,0.8)', marginTop: '4px' }}>
                {isDecimalsLoading
                  ? 'Fetching token decimals...'
                  : isDecimalsError
                  ? 'Failed to fetch token decimals - check token address'
                  : `Uses token decimals fetched from contract (${tokenDecimals})`}
              </p>
            )}
          </div>

          {/* Dates */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
            }}
          >
            <div>
              <label style={labelStyle}>Start Date</label>
              <input
                style={inputStyle}
                type="datetime-local"
                value={form.startDate}
                onChange={set('startDate')}
              />
              {errors.startDate && <div style={errorStyle}>{errors.startDate}</div>}
            </div>
            <div>
              <label style={labelStyle}>End Date</label>
              <input
                style={inputStyle}
                type="datetime-local"
                value={form.endDate}
                onChange={set('endDate')}
              />
              {errors.endDate && <div style={errorStyle}>{errors.endDate}</div>}
            </div>
          </div>

          {/* Liquidity % */}
          <div>
            <label style={labelStyle}>
              Liquidity Allocation — {form.liquidityPct}%
            </label>
            <input
              style={{ ...inputStyle, padding: '6px 14px' }}
              type="range"
              min="50"
              max="100"
              step="5"
              value={form.liquidityPct}
              onChange={set('liquidityPct')}
            />
            <p
              style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.3)',
                marginTop: '4px',
              }}
            >
              % of raised LTC that goes to SparkDex LP. Minimum 50%.
            </p>
          </div>

          {/* LP Lock */}
          <div>
            <label style={labelStyle}>LP Lock Duration</label>
            <select
              style={inputStyle}
              value={form.lpLockDays}
              onChange={set('lpLockDays')}
            >
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days (recommended)</option>
              <option value="365">1 year</option>
              <option value="730">2 years</option>
            </select>
          </div>

          {/* Whitelist */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              id="wl"
              type="checkbox"
              checked={form.whitelist}
              onChange={set('whitelist')}
              style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
            />
            <label
              htmlFor="wl"
              style={{
                fontSize: '14px',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
              }}
            >
              Enable whitelist (you control who can contribute)
            </label>
          </div>

          {/* Fee note (RP-003: live fee from contract) */}
          <div
            style={{
              padding: '14px',
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: '8px',
              fontSize: '13px',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            Creation fee:{' '}
            <strong style={{ color: 'rgba(255,255,255,0.9)' }}>{feeDisplay} LTC</strong>{' '}
            · Platform fee:{' '}
            <strong style={{ color: 'rgba(255,255,255,0.9)' }}>2% of raise</strong>{' '}
            at finalization
          </div>

          {/* Contract address guard warning */}
          {!iloFactoryValid && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '13px',
            }}>
              ⚠️ ILO Factory contract not deployed on this network. Presale creation is disabled.
            </div>
          )}

          {/* RP-001: Error if decimals fetch fails */}
          {isDecimalsError && isAddress(form.tokenAddress) && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '13px',
            }}>
              Failed to fetch token decimals. Please verify the token address is a valid ERC20 contract.
            </div>
          )}

          {/* Submit (RP-001, RP-003: gate on decimals and fee) */}
          <button
            onClick={handleCreate}
            disabled={!isConnected || !iloFactoryValid || isPending || isConfirming || !decimalsReady || !feeReady}
            style={{
              padding: '14px',
              background:
                !isConnected || !iloFactoryValid || isPending || isConfirming || !decimalsReady || !feeReady
                  ? 'rgba(99,102,241,0.3)'
                  : 'var(--accent)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 600,
              cursor:
                !isConnected || isPending || isConfirming || !decimalsReady || !feeReady
                  ? 'not-allowed'
                  : 'pointer',
              transition: 'opacity 0.2s',
            }}
          >
            {!isConnected
              ? 'Connect Wallet'
              : isPending
                ? 'Confirm in wallet…'
                : isConfirming
                  ? 'Creating presale…'
                  : isDecimalsLoading
                    ? 'Loading token decimals…'
                    : isFeeLoading
                      ? 'Loading fee…'
                      : `Create Presale — ${feeDisplay} LTC`}
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
  const progress =
    (parseFloat(presale.raised) / parseFloat(presale.hardCap)) * 100
  const timeLeft = presale.endTime - Date.now()
  const daysLeft = Math.max(0, Math.floor(timeLeft / 86400000))
  const hoursLeft = Math.max(
    0,
    Math.floor((timeLeft % 86400000) / 3600000),
  )
  const status = presale.finalized
    ? 'Finalized'
    : presale.cancelled
      ? 'Cancelled'
      : timeLeft > 0
        ? 'Live'
        : 'Ended'
  const statusColor =
    status === 'Live'
      ? '#4ade80'
      : status === 'Finalized'
        ? '#818cf8'
        : '#f87171'

  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '12px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>{presale.name}</div>
          <div
            style={{
              fontSize: '13px',
              color: 'rgba(255,255,255,0.4)',
              marginTop: '2px',
            }}
          >
            ${presale.symbol}
          </div>
        </div>
        <span
          style={{
            padding: '4px 10px',
            background: `${statusColor}22`,
            border: `1px solid ${statusColor}55`,
            borderRadius: '20px',
            fontSize: '12px',
            color: statusColor,
            fontWeight: 600,
          }}
        >
          ● {status}
        </span>
      </div>

      {/* Progress */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '13px',
            marginBottom: '8px',
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>Raised</span>
          <span>
            <strong style={{ color: 'var(--foreground)' }}>
              {presale.raised} LTC
            </strong>{' '}
            / {presale.hardCap} LTC
          </span>
        </div>
        <div
          style={{
            height: '6px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '3px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, progress)}%`,
              background: 'var(--accent)',
              borderRadius: '3px',
              transition: 'width 0.3s',
            }}
          />
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.3)',
            marginTop: '4px',
          }}
        >
          Soft cap: {presale.softCap} LTC · {presale.contributorCount}{' '}
          contributors
        </div>
      </div>

      {/* Details */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          fontSize: '13px',
        }}
      >
        {(
          [
            ['Time left', status === 'Live' ? `${daysLeft}d ${hoursLeft}h` : '—'],
            ['Liquidity', `${presale.liquidityBps / 100}% locked`],
            ['LP lock', `${Math.round(presale.lpLockDuration / 86400)}d`],
            ['DEX', 'SparkDex'],
          ] as [string, string][]
        ).map(([k, v]) => (
          <div key={k}>
            <div
              style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}
            >
              {k}
            </div>
            <div
              style={{ color: 'var(--foreground)', fontWeight: 500 }}
            >
              {v}
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <Link href={`/launchpad/${presale.address}`} style={{
        display: 'block',
        padding: '10px',
        background: 'transparent',
        border: '1px solid var(--accent)',
        borderRadius: '8px',
        color: 'var(--accent)',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        textAlign: 'center',
        textDecoration: 'none',
      }}>
        View Presale →
      </Link>
    </div>
  )
}

export default function LaunchpadPage() {
  const [tab, setTab] = useState<Tab>('browse')

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      <Navbar />
      <ToolHero
        category="Presale Platform"
        title="Lester"
        titleHighlight="Launch"
        subtitle="Community presales with automatic LP creation and locking on SparkDex. Self-service, permissionless, contract-enforced."
        color="#5E6AD2"
        image="/images/carousel/launchpad.png"
        stats={[
          { label: 'Mode', value: 'Permissionless' },
          { label: 'DEX', value: 'SparkDex' },
          { label: 'LP', value: 'Auto-created' },
          { label: 'Fee', value: '2% of raise' },
        ]}
      />
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '24px clamp(16px,4vw,40px) 60px',
        }}
      >

        {/* Stats bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1px',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '12px',
            overflow: 'hidden',
            marginBottom: '40px',
          }}
        >
          {(
            [
              ['Total Presales', '— (live at testnet)'],
              ['Total Raised', '— (live at testnet)'],
              ['Platform Fee', '2% of raise'],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div
              key={label}
              style={{
                background: 'var(--surface-1)',
                padding: '20px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  marginBottom: '4px',
                }}
              >
                {value}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '32px',
            background: 'var(--surface-1)',
            padding: '4px',
            borderRadius: '10px',
            width: 'fit-content',
          }}
        >
          {(['browse', 'create'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 20px',
                background:
                  tab === t ? 'var(--accent)' : 'transparent',
                border: 'none',
                borderRadius: '7px',
                color: tab === t ? '#fff' : 'rgba(255,255,255,0.5)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s',
              }}
            >
              {t === 'browse' ? '📡 Browse Presales' : '🚀 Create Presale'}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'browse' ? (
          <div>
            {MOCK_PRESALES.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '80px 20px',
                  color: 'rgba(255,255,255,0.3)',
                }}
              >
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>
                  🌑
                </div>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    marginBottom: '8px',
                  }}
                >
                  No active presales
                </div>
                <div style={{ fontSize: '14px' }}>
                  Be the first to launch on LitVM
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(340px, 1fr))',
                  gap: '20px',
                }}
              >
                {MOCK_PRESALES.map((p) => (
                  <PresaleCard key={p.address} presale={p} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <CreatePresaleForm />
        )}
      </div>
    </div>
  )
}

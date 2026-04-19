'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronDown, ChevronUp, ExternalLink, X } from 'lucide-react'

const ACCENT = '#E44FB5'
const EXPLORER_BASE = 'https://liteforge.explorer.caldera.xyz'

interface SettlementPreviewProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  confirming?: boolean
  // Input
  inputSymbol: string
  inputAmount: string // formatted
  inputAmountRaw: string // raw bigint string for display
  // Output
  outputSymbol: string
  outputAmount: string // formatted, after slippage
  outputAmountRaw: string
  // Details
  priceImpact: string
  pairAddress: string
  route: string
  estimatedGas?: string
  callData: string // raw hex
  targetContract: string
  functionName: string
}

export function SettlementPreview({
  isOpen,
  onClose,
  onConfirm,
  confirming = false,
  inputSymbol,
  inputAmount,
  outputSymbol,
  outputAmount,
  priceImpact,
  pairAddress,
  route,
  estimatedGas,
  callData,
  targetContract,
  functionName,
}: SettlementPreviewProps) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50"
          style={{ background: 'rgba(5, 3, 9, 0.85)', backdropFilter: 'blur(12px)' }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2"
          style={{
            background: '#0f0c18',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '24px',
            padding: '28px',
            boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
          }}
        >
          <Dialog.Close
            className="absolute right-5 top-5 transition-colors cursor-pointer"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            <X size={16} />
          </Dialog.Close>

          <Dialog.Title
            style={{
              fontFamily: 'var(--font-heading, sans-serif)',
              fontSize: '18px',
              fontWeight: 700,
              color: '#fff',
              marginBottom: '4px',
            }}
          >
            Settlement Preview
          </Dialog.Title>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '24px' }}>
            Review exactly what you are signing before confirming in your wallet.
          </p>

          {/* Direction arrow */}
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '16px 20px',
              marginBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                  You pay
                </p>
                <p style={{ fontSize: '22px', fontWeight: 700, color: '#fff' }}>
                  {inputAmount || '0'} <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontWeight: 500 }}>{inputSymbol}</span>
                </p>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '20px', textAlign: 'center' }}>→</div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                  You receive
                </p>
                <p style={{ fontSize: '22px', fontWeight: 700, color: '#fff' }}>
                  {outputAmount || '0'} <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontWeight: 500 }}>{outputSymbol}</span>
                </p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                  Min. receive (after slippage)
                </p>
              </div>
            </div>
          </div>

          {/* Meta details grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              marginBottom: '12px',
            }}
          >
            {[
              { label: 'Price impact', value: priceImpact || '—' },
              { label: 'Route', value: route },
              { label: 'Pair address', value: pairAddress ? `${pairAddress.slice(0, 8)}…${pairAddress.slice(-6)}` : '—' },
              { label: 'Est. gas', value: estimatedGas || '≈ gas' },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                }}
              >
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                  {label}
                </p>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#fff', fontFamily: label === 'Pair address' ? 'monospace' : 'inherit' }}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* You are signing */}
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '8px',
            }}
          >
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
              You are signing
            </p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
              <span style={{ color: ACCENT, fontFamily: 'monospace', fontSize: '12px' }}>{functionName}</span>
              {' '}on contract
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <a
                href={`${EXPLORER_BASE}/address/${targetContract}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: 'monospace', fontSize: '12px', color: ACCENT, textDecoration: 'none' }}
              >
                {targetContract}
              </a>
              <ExternalLink size={11} style={{ color: ACCENT, opacity: 0.7 }} />
            </div>
          </div>

          {/* CallData */}
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '20px',
            }}
          >
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
              Calldata (hex)
            </p>
            <p
              style={{
                fontFamily: 'monospace',
                fontSize: '11px',
                color: 'rgba(255,255,255,0.45)',
                wordBreak: 'break-all',
                lineHeight: 1.6,
              }}
            >
              {callData.slice(0, 80)}
              {callData.length > 80 && (
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>…</span>
              )}
            </p>

            <button
              onClick={() => setShowDetails((v) => !v)}
              style={{
                marginTop: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                color: 'rgba(255,255,255,0.4)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showDetails ? 'Hide details' : 'View full calldata'}
            </button>

            {showDetails && (
              <p
                style={{
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.35)',
                  wordBreak: 'break-all',
                  lineHeight: 1.8,
                  marginTop: '8px',
                  maxHeight: '120px',
                  overflowY: 'auto',
                }}
              >
                {callData}
              </p>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '14px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={confirming}
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: '14px',
                border: 'none',
                background: `linear-gradient(135deg, ${ACCENT} 0%, #b43684 100%)`,
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: confirming ? 'not-allowed' : 'pointer',
                opacity: confirming ? 0.7 : 1,
                boxShadow: '0 8px 24px rgba(228,79,181,0.3)',
              }}
            >
              {confirming ? 'Confirming…' : 'Confirm in Wallet'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

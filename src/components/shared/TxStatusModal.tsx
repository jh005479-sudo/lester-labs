'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { CheckCircle, XCircle, Loader2, ExternalLink, X } from 'lucide-react'

interface TxStatusModalProps {
  isOpen: boolean
  onClose: () => void
  status: 'pending' | 'success' | 'error'
  txHash?: string
  contractAddress?: string
  message?: string
  onRetry?: () => void
}

const EXPLORER_BASE = 'https://sepolia.arbiscan.io'

export function TxStatusModal({ isOpen, onClose, status, txHash, contractAddress, message, onRetry }: TxStatusModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          style={{ background: 'rgba(5, 3, 9, 0.85)', backdropFilter: 'blur(12px)' }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-8 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          style={{ background: 'var(--background)', border: '1px solid var(--surface-border)', borderRadius: '20px' }}
        >
          <Dialog.Close className="absolute right-5 top-5 transition-colors" style={{ color: 'var(--foreground-muted)' }}>
            <X size={16} />
          </Dialog.Close>

          <div className="flex flex-col items-center gap-5 text-center">
            {status === 'pending' && <Loader2 size={44} className="animate-spin" style={{ color: 'var(--accent)' }} />}
            {status === 'success' && <CheckCircle size={44} style={{ color: 'var(--success)' }} />}
            {status === 'error'   && <XCircle    size={44} style={{ color: 'var(--error)' }} />}

            <Dialog.Title className="text-lg font-semibold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
              {status === 'pending' && 'Submitting…'}
              {status === 'success' && 'Success'}
              {status === 'error'   && 'Failed'}
            </Dialog.Title>

            {message && <p className="text-sm" style={{ color: 'var(--foreground-dim)' }}>{message}</p>}
            {status === 'pending' && !message && <p className="text-sm" style={{ color: 'var(--foreground-dim)' }}>Waiting for confirmation…</p>}

            {txHash && (
              <a href={`${EXPLORER_BASE}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[13px] hover:underline" style={{ color: 'var(--accent)' }}>
                View transaction <ExternalLink size={11} />
              </a>
            )}

            {contractAddress && (
              <div className="w-full px-5 py-4 text-left"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: '12px' }}>
                <p className="mb-1 text-[11px] uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>Contract</p>
                <a href={`${EXPLORER_BASE}/address/${contractAddress}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 font-mono text-[12px] hover:underline break-all" style={{ color: 'var(--accent)' }}>
                  {contractAddress} <ExternalLink size={10} className="shrink-0" />
                </a>
              </div>
            )}

            <div className="flex gap-3 w-full pt-3">
              {status === 'error' && onRetry && (
                <button onClick={onRetry} className="cin-btn cin-btn-ghost flex-1 text-sm">Retry</button>
              )}
              <button onClick={onClose} className="cin-btn flex-1 text-sm">
                {status === 'pending' ? 'Close' : 'Done'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

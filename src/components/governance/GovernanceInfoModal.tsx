'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { Vote, X } from 'lucide-react'

interface GovernanceInfoModalProps {
  open: boolean
  onClose: () => void
}

export function GovernanceInfoModal({ open, onClose }: GovernanceInfoModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0f1117] p-6 shadow-xl focus:outline-none">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300">
                <Vote size={18} />
              </div>
              <Dialog.Title className="text-lg font-semibold text-white">
                Snapshot Integration Coming Soon
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="mb-6 text-sm leading-relaxed text-white/60">
            Governance proposals will be signed with your wallet (EIP-712) and stored on IPFS via
            Snapshot Hub. No gas required. Full integration arriving with LitVM testnet launch.
          </Dialog.Description>

          <button
            onClick={onClose}
            className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            Got it
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

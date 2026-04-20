'use client'

import { FeeDisplay } from '@/components/shared/FeeDisplay'
import { ConnectWalletPrompt } from '@/components/shared/ConnectWalletPrompt'
import { useAccount } from 'wagmi'
import { CheckCircle2 } from 'lucide-react'
import type { TokenBasics } from './StepBasics'
import type { TokenFeatures } from './StepFeatures'

interface StepReviewProps {
  basics: TokenBasics
  features: TokenFeatures
  onDeploy: () => void
  isDeploying: boolean
  isWrongNetwork?: boolean
  isSwitchingNetwork?: boolean
  feeDisplay?: string // RP-003: Live fee from contract
  feeReady?: boolean  // RP-003: Whether fee is loaded
}

interface SummaryRowProps {
  label: string
  value: React.ReactNode
}

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-white/50">{label}</span>
      <span className="text-sm font-medium text-white text-right">{value}</span>
    </div>
  )
}

function FeatureBadge({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        enabled
          ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
          : 'bg-white/5 text-white/30'
      }`}
    >
      {enabled && <CheckCircle2 size={10} />}
      {label}
    </span>
  )
}

export function StepReview({
  basics,
  features,
  onDeploy,
  isDeploying,
  isWrongNetwork = false,
  isSwitchingNetwork = false,
  feeDisplay = '0.05',
  feeReady = true,
}: StepReviewProps) {
  const { isConnected } = useAccount()

  const supplyDisplay = Number(basics.totalSupply).toLocaleString()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Review & Deploy</h2>
        <p className="mt-1 text-sm text-white/50">Confirm your token configuration before deploying.</p>
      </div>

      {/* Summary card */}
      <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 divide-y divide-white/5">
        <SummaryRow label="Token Name" value={basics.name || '—'} />
        <SummaryRow label="Symbol" value={
          <span className="font-mono">{basics.symbol || '—'}</span>
        } />
        <SummaryRow label="Total Supply" value={supplyDisplay || '—'} />
        <SummaryRow label="Decimals" value={basics.decimals} />
        <div className="py-2.5">
          <div className="flex items-start justify-between">
            <span className="text-sm text-white/50">Features</span>
            <div className="flex flex-wrap gap-1.5 justify-end max-w-[60%]">
              <FeatureBadge enabled={features.mintable} label="Mintable" />
              <FeatureBadge enabled={features.burnable} label="Burnable" />
              <FeatureBadge enabled={features.pausable} label="Pausable" />
            </div>
          </div>
        </div>
      </div>

      {/* Fee display (RP-003: live fee from contract) */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-5 py-4">
        <span className="text-sm font-medium text-white">Deployment Fee</span>
        <FeeDisplay feeLTC={parseFloat(feeDisplay) || 0.05} feeLabel="Total" />
      </div>

      {isConnected && isWrongNetwork && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          Wallet is connected to the wrong network. Switch to LitVM Testnet before deploying this token.
        </div>
      )}

      {/* Deploy / connect (RP-003: disable until fee loaded) */}
      {!isConnected ? (
        <ConnectWalletPrompt />
      ) : (
        <button
          onClick={onDeploy}
          disabled={isWrongNetwork ? isSwitchingNetwork : isDeploying || !feeReady}
          className="w-full rounded-xl bg-[var(--accent)] px-6 py-3.5 text-base font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isWrongNetwork
            ? isSwitchingNetwork
              ? 'Switching network…'
              : 'Switch to LitVM Testnet'
            : isDeploying
              ? 'Deploying…'
              : !feeReady
                ? 'Loading fee…'
                : 'Deploy Token'}
        </button>
      )}

      <p className="text-center text-xs text-white/30">
        A non-refundable deployment fee of {feeDisplay} zkLTC will be charged on confirmation.
      </p>
    </div>
  )
}

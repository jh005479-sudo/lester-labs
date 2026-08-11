interface FeeDisplayProps {
  feeLTC: number
  feeLabel: string
}

export function FeeDisplay({ feeLTC, feeLabel }: FeeDisplayProps) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-white/60">
      <span className="text-white/40">{feeLabel}:</span>
      <span className="font-medium text-white">{feeLTC} zkLTC</span>
      <span className="text-white/40">(LiteForge testnet asset; no represented USD value)</span>
    </span>
  )
}

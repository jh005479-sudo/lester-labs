'use client'

import { TokenLogoUpload } from '@/components/shared/TokenLogoUpload'

export interface TokenBasics {
  name: string
  symbol: string
  totalSupply: string
  decimals: 6 | 8 | 18
  logoUrl?: string
}

interface StepBasicsProps {
  values: TokenBasics
  onChange: (values: TokenBasics) => void
}

export function StepBasics({ values, onChange }: StepBasicsProps) {
  const set = <K extends keyof TokenBasics>(key: K, value: TokenBasics[K]) =>
    onChange({ ...values, [key]: value })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Token Basics</h2>
        <p className="mt-1 text-sm text-white/50">Define the core parameters of your token.</p>
      </div>

      {/* Token Name */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-white/80">
          Token Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={values.name}
          maxLength={50}
          placeholder="e.g. My Awesome Token"
          onChange={(e) => set('name', e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-colors"
        />
        <p className="text-xs text-white/40">Max 50 characters — this is what users will see in their wallet</p>
      </div>

      {/* Token Symbol */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-white/80">
          Token Symbol <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={values.symbol}
          maxLength={10}
          placeholder="e.g. MAT"
          onChange={(e) => set('symbol', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white font-mono placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-colors"
        />
        <p className="text-xs text-white/40">e.g. MAT — will appear on DEXes</p>
      </div>

      {/* Total Supply */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-white/80">
          Total Supply <span className="text-red-400">*</span>
        </label>
        <input
          type="number"
          value={values.totalSupply}
          min={1}
          max={1_000_000_000_000}
          placeholder="1000000"
          onChange={(e) => set('totalSupply', e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-colors"
        />
        <p className="text-xs text-white/40">Total tokens to mint on creation</p>
      </div>

      {/* Decimals */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-white/80">Decimals</label>
        <select
          value={values.decimals}
          onChange={(e) => set('decimals', Number(e.target.value) as 6 | 8 | 18)}
          className="w-full rounded-lg border border-white/10 bg-[var(--surface-2)] px-4 py-2.5 text-sm text-white focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-colors appearance-none cursor-pointer"
        >
          <option value={18}>18 (Standard)</option>
          <option value={8}>8</option>
          <option value={6}>6</option>
        </select>
        <p className="text-xs text-white/40">18 decimals is standard for most tokens</p>
      </div>

      {/* Token Logo */}
      <TokenLogoUpload
        currentUrl={values.logoUrl}
        onUrlChange={(url) => set('logoUrl', url)}
      />
    </div>
  )
}

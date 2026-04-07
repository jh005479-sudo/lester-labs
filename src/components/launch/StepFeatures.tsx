'use client'

import * as Switch from '@radix-ui/react-switch'
import { TriangleAlert } from 'lucide-react'

export interface TokenFeatures {
  mintable: boolean
  burnable: boolean
  pausable: boolean
}

interface StepFeaturesProps {
  values: TokenFeatures
  onChange: (values: TokenFeatures) => void
}

interface FeatureToggleProps {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function FeatureToggle({ id, label, description, checked, onCheckedChange }: FeatureToggleProps) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-white cursor-pointer">
          {label}
        </label>
        <p className="mt-0.5 text-xs text-white/50">{description}</p>
      </div>
      <Switch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative flex-shrink-0 h-6 w-11 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-black data-[state=checked]:bg-[var(--accent)] data-[state=unchecked]:bg-white/20"
      >
        <Switch.Thumb className="block h-5 w-5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
      </Switch.Root>
    </div>
  )
}

export function StepFeatures({ values, onChange }: StepFeaturesProps) {
  const set = <K extends keyof TokenFeatures>(key: K, value: boolean) =>
    onChange({ ...values, [key]: value })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Token Features</h2>
        <p className="mt-1 text-sm text-white/50">Configure optional capabilities for your token.</p>
      </div>

      <div className="space-y-3">
        <FeatureToggle
          id="mintable"
          label="Mintable"
          description="Owner can create additional tokens after launch"
          checked={values.mintable}
          onCheckedChange={(v) => set('mintable', v)}
        />
        <FeatureToggle
          id="burnable"
          label="Burnable"
          description="Token holders can permanently destroy their tokens"
          checked={values.burnable}
          onCheckedChange={(v) => set('burnable', v)}
        />
        <FeatureToggle
          id="pausable"
          label="Pausable"
          description="Owner can pause all token transfers in an emergency"
          checked={values.pausable}
          onCheckedChange={(v) => set('pausable', v)}
        />
      </div>

      {values.mintable && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <TriangleAlert size={16} className="mt-0.5 text-amber-300" />
          <p className="text-sm text-amber-300">
            Mintable tokens may be viewed as higher risk by investors
          </p>
        </div>
      )}
    </div>
  )
}

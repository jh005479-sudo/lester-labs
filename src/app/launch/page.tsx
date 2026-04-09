'use client'

import { Navbar } from '@/components/layout/Navbar'
import { TokenWizard } from '@/components/launch/TokenWizard'
import { Rocket } from 'lucide-react'

export default function LaunchPage() {
  return (
    <div className="min-h-screen bg-background premium-tight">
      <Navbar />
      <main className="app-shell" style={{ maxWidth: 920 }}>
        <div className="tool-hero">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-muted)]">
              <Rocket size={20} className="text-[var(--accent)]" />
            </div>
            <h1 className="tool-hero-title">Token Factory</h1>
          </div>
          <p className="tool-hero-copy">
            Deploy a custom ERC-20 token on LitVM in under a minute.
          </p>
        </div>

        <div className="tool-after-hero">
          <TokenWizard />
        </div>
      </main>
    </div>
  )
}

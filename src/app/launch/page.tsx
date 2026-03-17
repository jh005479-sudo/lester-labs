'use client'

import { Navbar } from '@/components/layout/Navbar'
import { TokenWizard } from '@/components/launch/TokenWizard'
import { Rocket } from 'lucide-react'

export default function LaunchPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 pt-32 pb-20">
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-muted)]">
              <Rocket size={20} className="text-[var(--accent)]" />
            </div>
            <h1 className="text-3xl font-bold text-white">Lester Minter</h1>
          </div>
          <p className="text-white/50">
            Deploy a custom ERC-20 token on LitVM in under a minute.
          </p>
        </div>

        <TokenWizard />
      </main>
    </div>
  )
}

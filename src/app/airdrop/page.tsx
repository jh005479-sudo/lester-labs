'use client'

import { Navbar } from '@/components/layout/Navbar'
import { AirdropForm } from '@/components/airdrop/AirdropForm'
import { Gift } from 'lucide-react'

export default function AirdropPage() {

  return (
    <div className="min-h-screen bg-background premium-tight">
      <Navbar />
      <main className="app-shell" style={{ maxWidth: 980 }}>
        <div className="tool-hero">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
              <Gift size={20} className="text-white" />
            </div>
            <h1 className="tool-hero-title">Airdrop</h1>
          </div>
          <p className="tool-hero-copy">
            Bulk-send tokens or zkLTC to hundreds of addresses in one click.
          </p>
        </div>

        <div className="tool-after-hero">
          <AirdropForm />
        </div>
      </main>
    </div>
  )
}

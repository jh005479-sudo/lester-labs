'use client'

import { Navbar } from '@/components/layout/Navbar'
import { AirdropForm } from '@/components/airdrop/AirdropForm'
import { Gift } from 'lucide-react'

export default function AirdropPage() {

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-32 pb-20">
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
              <Gift size={20} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">Lester Dropper</h1>
          </div>
          <p className="text-white/50">
            Bulk-send tokens or zkLTC to hundreds of addresses in one click.
          </p>
        </div>

        <AirdropForm />
      </main>
    </div>
  )
}

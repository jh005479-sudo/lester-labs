'use client'

import { Navbar } from '@/components/layout/Navbar'
import { AirdropForm } from '@/components/airdrop/AirdropForm'
import { ToolHero } from '@/components/shared/ToolHero'

export default function AirdropPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <Navbar />
      <ToolHero
        category="Mass Distribution"
        title="Lester"
        titleHighlight="Dropper"
        subtitle="Send tokens to hundreds of wallets in a single transaction. CSV import supported."
        color="#36D1DC"
        image="/images/carousel/airdrop.png"
        compact
        stats={[
          { label: 'Wallets', value: 'Hundreds' },
          { label: 'Import', value: 'CSV' },
          { label: 'Tx', value: 'Single' },
          { label: 'Fee', value: '0.01 zkLTC' },
        ]}
      />
      <div className="tool-page-content" style={{ maxWidth: '920px' }}>
        <AirdropForm />
      </div>
    </div>
  )
}

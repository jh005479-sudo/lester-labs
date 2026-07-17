'use client'

import { AirdropForm } from '@/components/airdrop/AirdropForm'
import { ToolHero } from '@/components/shared/ToolHero'

export default function AirdropPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <ToolHero
        category="Mass Distribution"
        title="Lester"
        titleHighlight="Dropper"
        subtitle="Validate recipient lists locally and send ERC-20 or native zkLTC in resumable wallet-confirmed batches."
        color="#36D1DC"
        image="/images/carousel/airdrop.png"
        compact
        stats={[
          { label: 'Wallets', value: 'Hundreds' },
          { label: 'Import', value: 'CSV' },
          { label: 'Batch', value: 'Up to 200' },
          { label: 'Progress', value: 'Resumable' },
        ]}
      />
      <div className="tool-page-content" style={{ maxWidth: '920px' }}>
        <AirdropForm />
      </div>
    </div>
  )
}

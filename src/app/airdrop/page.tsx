'use client'

import { AirdropForm } from '@/components/airdrop/AirdropForm'
import { ToolHero } from '@/components/shared/ToolHero'

export default function AirdropPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <ToolHero
        category="Containment / Batch Distribution"
        title="Lester"
        titleHighlight="Dropper"
        subtitle="Validate recipient files locally and inspect the batch workflow. New distributions remain disabled until the post-compromise deployment set is source-pinned."
        color="#36D1DC"
        image="/images/carousel/airdrop.png"
        compact
        stats={[
          { label: 'Validation', value: 'Local' },
          { label: 'Import', value: 'CSV' },
          { label: 'Batch', value: 'Up to 200' },
          { label: 'Writes', value: 'Disabled' },
        ]}
      />
      <div className="tool-page-content" style={{ maxWidth: '920px' }}>
        <AirdropForm />
      </div>
    </div>
  )
}

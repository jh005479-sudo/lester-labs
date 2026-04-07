'use client'

import { useParams } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import Link from 'next/link'
import { Rocket } from 'lucide-react'

export default function PresalePage() {
  const { address } = useParams<{ address: string }>()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
      <Navbar />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '80px 24px 60px', textAlign: 'center' }}>
        <div style={{ marginBottom: '20px', display: 'inline-flex' }}><Rocket size={36} color="var(--accent)" /></div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '12px' }}>Presale Details</h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', fontFamily: 'monospace' }}>
          {address}
        </p>
        <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', marginBottom: '32px', lineHeight: 1.6 }}>
          Individual presale pages with live on-chain data will be available once the ILOFactory is deployed to testnet.
        </p>
        <Link href="/launchpad" style={{
          color: 'var(--accent)',
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: 600,
          border: '1px solid var(--accent)',
          padding: '10px 24px',
          borderRadius: '8px',
        }}>
          ← Back to Launchpad
        </Link>
      </div>
    </div>
  )
}

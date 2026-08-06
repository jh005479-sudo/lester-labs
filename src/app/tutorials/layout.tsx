import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Safety, Recovery & Readiness Guides for LitVM | Lester Labs',
  description: 'Guides to LitVM LiteForge, Lester Labs post-compromise containment, legacy-position recovery, bounded explorer views, and replacement-deployment verification.',
  keywords: ['LitVM safety guide', 'LitVM testnet recovery', 'Lester Labs security status', 'LitVM explorer limits', 'legacy DEX recovery'],
}

export default function TutorialsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

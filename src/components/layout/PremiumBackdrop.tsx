'use client'

import { usePathname } from 'next/navigation'

export function PremiumBackdrop() {
  const pathname = usePathname()
  if (pathname === '/') return null

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{
        zIndex: 0,
        backgroundImage: [
          'radial-gradient(1100px 700px at 14% 0%, rgba(107,79,255,0.22) 0%, rgba(107,79,255,0.07) 36%, transparent 72%)',
          'radial-gradient(1000px 640px at 86% 10%, rgba(79,118,255,0.17) 0%, rgba(79,118,255,0.05) 34%, transparent 70%)',
          'radial-gradient(1300px 820px at 50% 118%, rgba(125,88,255,0.12) 0%, rgba(125,88,255,0.03) 38%, transparent 74%)',
          'radial-gradient(150% 130% at 50% 50%, transparent 56%, rgba(0,0,0,0.42) 100%)',
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'%3E%3Cg fill='%23ffffff' fill-opacity='0.035'%3E%3Ccircle cx='10' cy='20' r='1'/%3E%3Ccircle cx='96' cy='56' r='1'/%3E%3Ccircle cx='176' cy='32' r='1'/%3E%3Ccircle cx='48' cy='138' r='1'/%3E%3Ccircle cx='132' cy='176' r='1'/%3E%3Ccircle cx='202' cy='122' r='1'/%3E%3C/g%3E%3C/svg%3E\")",
        ].join(', '),
      }}
    />
  )
}

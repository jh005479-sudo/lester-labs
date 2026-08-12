import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import { Navbar } from '@/components/layout/Navbar'
import { LTCBanner } from '@/components/LTCBanner'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { PremiumBackdrop } from '@/components/layout/PremiumBackdrop'
import { PUBLIC_RELEASE_STATUS } from '@/lib/publicReleaseStatus'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://www.lester-labs.com'),
  title: {
    default: 'Lester Labs — A LitVM Native DeFi Suite',
    // Route metadata already includes the brand. Keep it from being appended twice.
    template: '%s',
  },
  description: PUBLIC_RELEASE_STATUS.metadataDescription,
  keywords: [
    'Lester Labs',
    'LitVM DEX',
    'LitVM swap',
    'LitVM batch token distribution',
    'LitVM launchpad',
    'LitVM DeFi',
    'LitVM token factory',
    'LitVM liquidity locker',
    'LitVM block explorer',
    'LesterLabs',
    'Lester-Labs',
  ],
  alternates: { canonical: 'https://www.lester-labs.com' },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/icon-192.png',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'Lester Labs — A LitVM Native DeFi Suite',
    description: PUBLIC_RELEASE_STATUS.openGraphDescription,
    url: 'https://www.lester-labs.com',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lester Labs — A LitVM Native DeFi Suite',
    description: PUBLIC_RELEASE_STATUS.twitterDescription,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className="antialiased"
        style={{
          fontFamily: 'var(--font-body)',
        }}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Lester Labs',
              url: 'https://www.lester-labs.com',
              logo: 'https://www.lester-labs.com/favicon.ico',
              description: PUBLIC_RELEASE_STATUS.structuredDataDescription,
              sameAs: [
                'https://x.com/lesterlabshq',
              ],
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: 'https://www.lester-labs.com/explorer?q={search_term_string}',
                },
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
        <Providers>
          <PremiumBackdrop />
          <LTCBanner />
          <Navbar />
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  )
}

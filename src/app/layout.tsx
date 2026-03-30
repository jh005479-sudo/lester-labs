import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Providers } from './providers'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'Lester Labs — DeFi Utilities for LitVM',
    template: '%s | Lester Labs',
  },
  description:
    'The DeFi utility suite for LitVM — Token Factory, Liquidity Locker, Vesting, Airdrop, Governance & Launchpad. Battle-tested contracts. Live on testnet.',
  keywords: [
    'LitVM',
    'DeFi',
    'Token Factory',
    'Liquidity Locker',
    'Token Vesting',
    'Airdrop',
    'Governance',
    'Launchpad',
    'Litecoin',
    'EVM',
    'Web3',
  ],
  authors: [{ name: 'Lester Labs' }],
  creator: 'Lester Labs',
  publisher: 'Lester Labs',
  metadataBase: new URL('https://lester-labs.vercel.app'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://lester-labs.vercel.app',
    siteName: 'Lester Labs',
    title: 'Lester Labs — DeFi Utilities for LitVM',
    description:
      'Token Factory, Locker, Vesting, Airdrop, Governance & Launchpad. Battle-tested contracts built for LitVM.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Lester Labs — DeFi Utilities for LitVM',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@LesterLabs',
    creator: '@LesterLabs',
    title: 'Lester Labs — DeFi Utilities for LitVM',
    description:
      'Token Factory, Locker, Vesting, Airdrop, Governance & Launchpad. Battle-tested contracts built for LitVM.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

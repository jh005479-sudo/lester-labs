import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'X-XSS-Protection', value: '0' },
        ],
      },
    ]
  },
  async redirects() {
    return [
      { source: '/docs/dex-swap', destination: '/docs', permanent: true },
      { source: '/docs/airdrop-tool', destination: '/docs', permanent: true },
      { source: '/docs/token-factory', destination: '/docs', permanent: true },
      { source: '/docs/liquidity-locker', destination: '/docs', permanent: true },
      { source: '/docs/token-vesting', destination: '/docs', permanent: true },
      { source: '/docs/governance', destination: '/docs', permanent: true },
      { source: '/docs/launchpad', destination: '/docs', permanent: true },
      { source: '/docs/ledger', destination: '/docs', permanent: true },
    ]
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

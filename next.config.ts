import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;

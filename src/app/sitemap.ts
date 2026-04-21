import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://lester-labs.com'

  const routes = [
    '',
    '/litvm-dex',
    '/litvm-swap',
    '/litvm-airdrop',
    '/litvm-launchpad',
    '/launch',
    '/locker',
    '/vesting',
    '/airdrop',
    '/governance',
    '/launchpad',
    '/swap',
    '/pool',
    '/ledger',
    '/explorer',
    '/analytics',
    '/docs',
    '/tutorials',
    '/portfolio',
    // Doc sub-pages
    '/docs/token-factory',
    '/docs/liquidity-locker',
    '/docs/token-vesting',
    '/docs/airdrop-tool',
    '/docs/governance',
    '/docs/launchpad',
    '/docs/dex-swap',
    '/docs/ledger',
  ]

  const docSlugs = ['token-factory', 'liquidity-locker', 'token-vesting', 'airdrop-tool', 'governance', 'launchpad', 'dex-swap', 'ledger']

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' || route === '/litvm-dex' ? 'weekly' : 'monthly',
    priority: route === '' ? 1
      : ['/litvm-dex', '/litvm-swap', '/litvm-airdrop', '/litvm-launchpad'].includes(route) ? 0.9
      : docSlugs.some(s => route === `/docs/${s}`) ? 0.7
      : 0.8,
  }))
}

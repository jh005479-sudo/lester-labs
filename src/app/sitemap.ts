import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.lester-labs.com'
  // Keep sitemap freshness factual. Using `new Date()` here would falsely tell
  // crawlers that every route changed every time this function ran.
  const containmentRevision = new Date('2026-08-04T00:00:00.000Z')

  const routes: { route: string; priority: number; changefreq: 'weekly' | 'monthly' }[] = [
    { route: '', priority: 1, changefreq: 'weekly' },
    { route: '/docs', priority: 0.9, changefreq: 'weekly' },
    { route: '/tutorials', priority: 0.8, changefreq: 'monthly' },
    { route: '/litvm-testnet', priority: 0.75, changefreq: 'monthly' },
    { route: '/explorer', priority: 0.7, changefreq: 'monthly' },
    { route: '/analytics', priority: 0.65, changefreq: 'monthly' },
    { route: '/portfolio', priority: 0.6, changefreq: 'monthly' },
    { route: '/tutorials/litvm-block-explorer', priority: 0.65, changefreq: 'monthly' },
    { route: '/tutorials/what-is-litvm', priority: 0.65, changefreq: 'monthly' },
    { route: '/tutorials/setting-up-litvm-wallet', priority: 0.65, changefreq: 'monthly' },
    { route: '/tutorials/understanding-zklktc', priority: 0.6, changefreq: 'monthly' },
    { route: '/tutorials/launchpad-how-it-works', priority: 0.55, changefreq: 'monthly' },
    { route: '/litvm-dex', priority: 0.55, changefreq: 'monthly' },
    { route: '/litvm-swap', priority: 0.55, changefreq: 'monthly' },
    { route: '/litvm-airdrop', priority: 0.55, changefreq: 'monthly' },
    { route: '/litvm-launchpad', priority: 0.55, changefreq: 'monthly' },
    { route: '/launchpad', priority: 0.5, changefreq: 'monthly' },
    { route: '/swap', priority: 0.5, changefreq: 'monthly' },
    { route: '/pool', priority: 0.5, changefreq: 'monthly' },
    { route: '/locker', priority: 0.45, changefreq: 'monthly' },
    { route: '/vesting', priority: 0.45, changefreq: 'monthly' },
    { route: '/ledger', priority: 0.45, changefreq: 'monthly' },
    { route: '/launch', priority: 0.4, changefreq: 'monthly' },
    { route: '/airdrop', priority: 0.4, changefreq: 'monthly' },
    { route: '/governance', priority: 0.4, changefreq: 'monthly' },
  ]

  return routes.map(({ route, priority, changefreq }) => ({
    url: `${baseUrl}${route}`,
    lastModified: containmentRevision,
    changeFrequency: changefreq,
    priority,
  }))
}

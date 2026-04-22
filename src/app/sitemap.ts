import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.lester-labs.com'

  const routes: { route: string; priority: number; changefreq: 'weekly' | 'monthly' }[] = [
    { route: '', priority: 1, changefreq: 'weekly' },
    { route: '/litvm-dex', priority: 0.9, changefreq: 'weekly' },
    { route: '/litvm-testnet', priority: 0.9, changefreq: 'weekly' },
    { route: '/litvm-swap', priority: 0.9, changefreq: 'weekly' },
    { route: '/litvm-airdrop', priority: 0.9, changefreq: 'weekly' },
    { route: '/litvm-launchpad', priority: 0.9, changefreq: 'weekly' },
    { route: '/launch', priority: 0.8, changefreq: 'monthly' },
    { route: '/locker', priority: 0.8, changefreq: 'monthly' },
    { route: '/vesting', priority: 0.8, changefreq: 'monthly' },
    { route: '/airdrop', priority: 0.8, changefreq: 'monthly' },
    { route: '/governance', priority: 0.8, changefreq: 'monthly' },
    { route: '/launchpad', priority: 0.8, changefreq: 'monthly' },
    { route: '/swap', priority: 0.8, changefreq: 'monthly' },
    { route: '/pool', priority: 0.8, changefreq: 'monthly' },
    { route: '/ledger', priority: 0.8, changefreq: 'monthly' },
    { route: '/explorer', priority: 0.7, changefreq: 'monthly' },
    { route: '/analytics', priority: 0.7, changefreq: 'monthly' },
    { route: '/docs', priority: 0.8, changefreq: 'monthly' },
    { route: '/tutorials', priority: 0.8, changefreq: 'monthly' },
    { route: '/tutorials/litvm-block-explorer', priority: 0.8, changefreq: 'monthly' },
    { route: '/tutorials/what-is-litvm', priority: 0.7, changefreq: 'monthly' },
    { route: '/tutorials/setting-up-litvm-wallet', priority: 0.7, changefreq: 'monthly' },
    { route: '/tutorials/understanding-zklktc', priority: 0.7, changefreq: 'monthly' },
    { route: '/tutorials/launchpad-how-it-works', priority: 0.7, changefreq: 'monthly' },
    { route: '/portfolio', priority: 0.7, changefreq: 'monthly' },
  ]

  return routes.map(({ route, priority, changefreq }) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: changefreq,
    priority,
  }))
}

import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://lester-labs.com'

  const routes = [
    '',
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
  ]

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : 0.8,
  }))
}

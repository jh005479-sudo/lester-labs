export type LaunchpadTab = 'browse' | 'create'

export type LaunchpadReadPlan = {
  factoryCount: boolean
  presaleAddresses: boolean
  presaleData: boolean
  tokenMetadata: boolean
  tokenImages: boolean
}

export function shouldLoadPresaleBrowseData(tab: LaunchpadTab): boolean {
  return tab === 'browse'
}

export function getLaunchpadReadPlan(tab: LaunchpadTab): LaunchpadReadPlan {
  const loadBrowseData = shouldLoadPresaleBrowseData(tab)

  return {
    factoryCount: loadBrowseData,
    presaleAddresses: loadBrowseData,
    presaleData: loadBrowseData,
    tokenMetadata: loadBrowseData,
    tokenImages: loadBrowseData,
  }
}

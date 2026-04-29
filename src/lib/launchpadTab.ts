export type LaunchpadTab = 'browse' | 'create'

export function shouldLoadPresaleBrowseData(tab: LaunchpadTab): boolean {
  return tab === 'browse'
}

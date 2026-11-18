import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { validateFrontendReleasePolicy, validateRouteSourceCoverageAgainstSources } from '../../scripts/security/frontend-release-common.mjs'

test('every tracked page, API and shared execution surface has reviewed release coverage', () => {
  const policy = validateFrontendReleasePolicy(JSON.parse(readFileSync(new URL('../config/frontendReleasePolicy.json', import.meta.url), 'utf8')))
  const paths = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
  validateRouteSourceCoverageAgainstSources(policy, paths)
})

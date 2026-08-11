import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { verifyEmergencyContainment } from '../../scripts/security/verify-emergency-containment.mjs'

const emergencyRoot = fileURLToPath(new URL('../../emergency-site', import.meta.url))

describe('wallet-free emergency containment artifact', () => {
  it('contains only reviewed static files, exact analytics floors, and fail-closed headers', () => {
    const result = verifyEmergencyContainment({ root: emergencyRoot })
    assert.equal(result.interactionSurface, 'none')
    assert.deepEqual(result.files.map(({ path }) => path), [
      '.well-known/security.txt',
      'index.html',
      'robots.txt',
      'vercel.json',
    ])
    assert.equal(
      result.files.find(({ path }) => path === 'index.html')?.sha256,
      'd9b43613185227433a6b08fabfe97d1baa967f209f373a7ae539cf6a3e5f2d22',
    )
    assert.deepEqual(result.analyticsFloor, {
      onChainMessages: 66_776,
      presalesCreated: 8_451,
      swapsCompleted: 12_975,
      tokensMinted: 500_139,
      walletsAirdropped: 16_433,
    })
  })

  it('rejects an injected active resource before packaging', () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'lester-emergency-'))
    try {
      cpSync(emergencyRoot, temporaryRoot, { recursive: true })
      const htmlPath = join(temporaryRoot, 'index.html')
      writeFileSync(htmlPath, `${readFileSync(htmlPath, 'utf8')}<script src="https://evil.invalid/x.js"></script>\n`)
      assert.throws(
        () => verifyEmergencyContainment({ root: temporaryRoot }),
        /forbidden active markup/i,
      )
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true })
    }
  })

  it('rejects conditional or duplicate security headers', () => {
    for (const mutate of [
      (configuration) => { configuration.headers[0].has = [{ type: 'header', key: 'x-allow', value: '1' }] },
      (configuration) => { configuration.headers[0].headers.push(structuredClone(configuration.headers[0].headers[0])) },
    ]) {
      const temporaryRoot = mkdtempSync(join(tmpdir(), 'lester-emergency-headers-'))
      try {
        cpSync(emergencyRoot, temporaryRoot, { recursive: true })
        const configurationPath = join(temporaryRoot, 'vercel.json')
        const configuration = JSON.parse(readFileSync(configurationPath, 'utf8'))
        mutate(configuration)
        writeFileSync(configurationPath, `${JSON.stringify(configuration, null, 2)}\n`)
        assert.throws(
          () => verifyEmergencyContainment({ root: temporaryRoot }),
          /unreviewed fields|headers must be unique/i,
        )
      } finally {
        rmSync(temporaryRoot, { recursive: true, force: true })
      }
    }
  })

  it('rejects CSS/SVG loads, changed visible metrics, social-engineering copy, and extra contacts', () => {
    const mutations = [
      ['index.html', (value) => value.replace('</style>', 'body{background-image:url(/beacon.png)}</style>'), /forbidden active markup/i],
      ['index.html', (value) => value.replace('</main>', '<svg><use href="/evil.svg#x"></use></svg></main>'), /unreviewed element|forbidden active markup/i],
      ['index.html', (value) => value.replace('<strong>500,139</strong>', '<strong>9,999,999</strong>'), /visible metric/i],
      ['index.html', (value) => value.replace('does not operate or verify any LitVM reward', 'operates and verifies a LitVM reward'), /required disclosure/i],
      ['index.html', (value) => value.replace('</footer>', 'Provide your seed phrase to continue.</footer>'), /forbidden active markup/i],
      ['.well-known/security.txt', (value) => `${value}Contact: mailto:attacker@invalid.example\n`, /complete reviewed policy/i],
    ]
    for (const [path, mutate, pattern] of mutations) {
      const temporaryRoot = mkdtempSync(join(tmpdir(), 'lester-emergency-content-'))
      try {
        cpSync(emergencyRoot, temporaryRoot, { recursive: true })
        const target = join(temporaryRoot, path)
        writeFileSync(target, mutate(readFileSync(target, 'utf8')))
        assert.throws(() => verifyEmergencyContainment({ root: temporaryRoot }), pattern)
      } finally {
        rmSync(temporaryRoot, { recursive: true, force: true })
      }
    }
  })
})

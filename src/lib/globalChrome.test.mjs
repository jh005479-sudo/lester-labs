import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

async function collectTsxFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectTsxFiles(fullPath)
    if (entry.isFile() && entry.name.endsWith('.tsx')) return [fullPath]
    return []
  }))

  return files.flat()
}

describe('global app chrome', () => {
  it('keeps the fixed navbar and LTC banner owned by the root layout', async () => {
    const appDir = path.join(process.cwd(), 'src/app')
    const files = await collectTsxFiles(appDir)
    const offenders = []

    for (const file of files) {
      const relative = path.relative(appDir, file)
      if (relative === 'layout.tsx') continue

      const source = await readFile(file, 'utf8')
      if (/(import\s+\{[^}]*\b(?:Navbar|LTCBanner)\b[^}]*\}\s+from|<(?:Navbar|LTCBanner)\b)/.test(source)) {
        offenders.push(relative)
      }
    }

    assert.deepEqual(offenders, [])
  })
})

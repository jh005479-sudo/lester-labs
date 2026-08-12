import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

function workflow(name) {
  return readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), 'utf8')
}

function shellRunBlocks(contents) {
  const lines = contents.split('\n')
  const blocks = []
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(\s*)run: \|[-+]?\s*$/u.exec(lines[index])
    if (!match) continue
    const indentation = match[1].length
    const block = []
    for (index += 1; index < lines.length; index += 1) {
      const line = lines[index]
      if (line.trim() !== '' && /^\s*/u.exec(line)[0].length <= indentation) {
        index -= 1
        break
      }
      block.push(line)
    }
    blocks.push(block.join('\n'))
  }
  return blocks
}

describe('Vercel release orchestration', () => {
  it('separates validation, disposable canary, staging, human approval, promotion, and rollback', () => {
    const canary = workflow('vercel-provider-canary.yml')
    const release = workflow('vercel-production-release.yml')
    const rollback = workflow('vercel-production-rollback.yml')

    assert.match(canary, /validate-inputs:\n[\s\S]*?runs-on: ubuntu-24\.04/)
    assert.match(canary, /canary:\n[\s\S]*?needs: validate-inputs[\s\S]*?environment: frontend-vercel-provider-canary/)
    assert.match(canary, /test "\$CANARY_PROJECT_ID" != "\$PRODUCTION_PROJECT_ID"/)
    assert.match(canary, /provider-canary-(?:emergency|next)/)

    assert.match(release, /validate-inputs:\n[\s\S]*?runs-on: ubuntu-24\.04/)
    assert.match(release, /stage:\n[\s\S]*?environment: frontend-vercel-staging/)
    assert.match(release, /staged-parity:\n[\s\S]*?name: frontend-vercel-staged-parity/)
    assert.match(release, /promotion-approval:\n[\s\S]*?name: frontend-production-promotion/)
    assert.match(release, /name: Human approval for \$\{\{ needs\.stage\.outputs\.deployment_id \}\}/)
    assert.match(release, /url: \$\{\{ needs\.stage\.outputs\.deployment_url \}\}/)
    assert.match(release, /promote:\n[\s\S]*?environment: frontend-vercel-promotion-executor/)
    assert.match(release, /id: compensate-promotion-failure[\s\S]*?VERCEL_PROMOTION_COMPENSATION_TOKEN/)
    assert.match(release, /steps\.promote-operation\.outcome != 'success'/)
    assert.match(release, /steps\.upload-promotion-evidence\.outcome != 'success'/)
    assert.match(release, /vercel-rest-release\.mjs recover-promotion/)
    assert.match(release, /vercel-promotion-compensation\/recovery-evidence\.json/)
    assert.match(release, /vercel-rest-release\.mjs cleanup-stage/)
    assert.match(release, /VERCEL_STAGE_CLEANUP_TOKEN/)
    assert.match(release, /cleanup-unpromoted-stage:/)
    assert.match(release, /needs\.staged-parity\.result != 'success'/)
    assert.match(release, /needs\.promotion-approval\.result != 'success'/)
    assert.match(release, /name: Delete only the signed noncurrent staged deployment/)
    assert.match(release, /rollback-on-parity-failure:\n[\s\S]*?environment: frontend-vercel-automatic-rollback/)
    assert.match(release, /rollback-on-parity-failure:\n[\s\S]*?needs:\n(?:\s+- [^\n]+\n)*\s+- stage\n/)
    assert.match(release, /rollback-on-parity-failure:\n[\s\S]*?artifact-ids: \$\{\{ needs\.stage\.outputs\.stage_artifact_id \}\}/)
    assert.match(release, /needs\.frontend-production-parity\.result != 'success'/)
    assert.match(release, /needs\.emergency-production-parity\.result != 'success'/)
    assert.match(release, /uses: \.\/\.github\/workflows\/frontend-served-parity\.yml/)
    assert.match(release, /uses: \.\/\.github\/workflows\/emergency-served-parity\.yml/)

    assert.match(rollback, /expected_promoted_deployment_id:/)
    assert.match(rollback, /adapter_commit:/)
    assert.match(rollback, /promotion_source_commit:/)
    assert.match(rollback, /environment: frontend-vercel-rollback/)
    assert.match(rollback, /value\.deployment\?\.id !== deploymentId/)
    assert.match(rollback, /vercel-rest-release\.mjs rollback/)
  })

  it('cryptographically binds exact source, canary, stage, parity, approval, and promotion subjects', () => {
    const canary = workflow('vercel-provider-canary.yml')
    const release = workflow('vercel-production-release.yml')
    const rollback = workflow('vercel-production-rollback.yml')
    const emergencyParity = workflow('emergency-served-parity.yml')
    const frontendParity = workflow('frontend-served-parity.yml')

    for (const contents of [canary, release, emergencyParity]) {
      assert.match(contents, /--source-ref refs\/heads\/main/)
      assert.match(contents, /--source-digest "\$REVIEWED_COMMIT"/)
      assert.match(contents, /--signer-digest "\$REVIEWED_COMMIT"/)
    }
    assert.match(frontendParity, /--source-digest "\$GITHUB_SHA"/)
    assert.match(frontendParity, /--signer-digest "\$GITHUB_SHA"/)
    assert.match(rollback, /--source-digest "\$PROMOTION_SOURCE_COMMIT"/)
    assert.match(rollback, /--signer-digest "\$PROMOTION_SOURCE_COMMIT"/)
    assert.match(canary, /--deny-self-hosted-runners/)
    assert.match(release, /provider-canary\.provenance\.jsonl/)
    assert.match(release, /stage-evidence\.provenance\.jsonl/)
    assert.match(release, /staged-parity\.provenance\.jsonl/)
    assert.match(release, /promotion-approval\.provenance\.jsonl/)
    assert.match(release, /promotion-evidence\.provenance\.jsonl/)
    assert.match(release, /--stage-provenance/)
    assert.match(release, /--provider-canary-evidence/)
    assert.match(release, /--provider-canary-provenance/)
    assert.match(release, /safe_rollback_commit:/)
    assert.match(release, /safe_rollback_run_id:/)
    assert.match(release, /--safe-rollback-promotion-evidence/)
    assert.match(release, /--safe-rollback-parity-evidence/)
    assert.match(release, /signed hold-or-safe-rollback disposition/)
    assert.match(release, /provider_canary_run_attempt/)
    assert.match(release, /attestation_run_attempt/)
    assert.match(emergencyParity, /promotion_run_attempt/)
    assert.match(frontendParity, /promotion_run_attempt/)
    assert.match(frontendParity, /--promotion-verification -/)
    assert.match(emergencyParity, /--promotion-verification -/)
    assert.match(rollback, /--deny-self-hosted-runners/)
  })

  it('keeps Vercel tokens step-scoped and performs no dependency install or provider CLI execution', () => {
    const files = [
      'vercel-provider-canary.yml',
      'vercel-production-release.yml',
      'vercel-production-rollback.yml',
      'emergency-served-parity.yml',
      'frontend-served-parity.yml',
    ]
    const combined = files.map(workflow).join('\n')
    assert.doesNotMatch(combined, /npm\s+(?:ci|install)|npm exec|\bnpx\b/)
    assert.doesNotMatch(combined, /\bvercel\s+(?:deploy|promote|rollback|build|pull)\b/)
    assert.doesNotMatch(combined, /(?:echo|printf)[^\n]*VERCEL_(?:CANARY|STAGING|PROMOTION(?:_COMPENSATION)?|AUTOMATIC_ROLLBACK|ROLLBACK)_TOKEN/)
    const tokenSelections = combined.split('\n').filter((line) => line.includes('VERCEL_TOKEN: ${{'))
    assert.equal(tokenSelections.length, 8)
    assert.equal(tokenSelections.every((line) => (
      /secrets\.VERCEL_(?:CANARY|STAGING|STAGE_CLEANUP|PROMOTION|PROMOTION_COMPENSATION|AUTOMATIC_ROLLBACK|ROLLBACK)_TOKEN/u.test(line)
    )), true)
    assert.match(combined, /release_profile == 'public-testnet-immutable' && secrets\.VERCEL_TOKEN/)
    assert.match(combined, /secrets\.VERCEL_CANARY_TOKEN/)
    assert.match(combined, /secrets\.VERCEL_STAGING_TOKEN/)
    assert.match(combined, /secrets\.VERCEL_PROMOTION_TOKEN/)
    assert.match(combined, /ACTIONS_ID_TOKEN_REQUEST_URL/)
    assert.match(combined, /::add-mask::/)
    assert.match(combined, /VERCEL_TRUSTED_OIDC_TOKEN=\\n/)
  })

  it('pins the gh verifier and uses the bounded wrapper inside every attestation-verification shell block', () => {
    const files = [
      'frontend-release-attestation.yml',
      'vercel-provider-canary.yml',
      'vercel-production-release.yml',
      'vercel-production-rollback.yml',
      'emergency-served-parity.yml',
      'frontend-served-parity.yml',
    ]
    let verificationBlocks = 0
    for (const name of files) {
      for (const block of shellRunBlocks(workflow(name))) {
        if (!block.includes('verify-gh-attestation-with-retry.sh') && !block.includes('gh attestation verify')) continue
        verificationBlocks += 1
        assert.match(block, /source scripts\/security\/use-reviewed-gh\.sh/)
      }
    }
    assert.ok(verificationBlocks >= 10)
  })

  it('uses run-attempt-qualified release artifacts and has one EU and one US vantage job', () => {
    const release = workflow('vercel-production-release.yml')
    const emergencyParity = workflow('emergency-served-parity.yml')
    const frontendParity = workflow('frontend-served-parity.yml')
    const source = workflow('frontend-release-attestation.yml')
    const emergencySource = workflow('emergency-containment-attestation.yml')
    const combined = [release, emergencyParity, frontendParity, source, emergencySource].join('\n')
    for (const prefix of [
      'vercel-stage-',
      'vercel-promotion-',
      'emergency-parity-',
      'frontend-parity-',
      'frontend-release-candidate-',
      'frontend-release-approved-evidence-',
      'emergency-containment-',
    ]) {
      const lines = combined.split('\n').filter((line) => line.includes(`name: ${prefix}`))
      assert.ok(lines.length > 0, `missing ${prefix} artifact coverage`)
      assert.equal(
        lines.every((line) => line.includes('run_attempt') || line.includes('run-attempt') || line.includes('artifact_name')),
        true,
        `${prefix} artifact name is not run-attempt qualified`,
      )
    }
    assert.equal((frontendParity.match(/^  vantage-eu:/gmu) ?? []).length, 1)
    assert.equal((frontendParity.match(/^  vantage-us:/gmu) ?? []).length, 1)
    assert.equal((emergencyParity.match(/^  vantage-eu:/gmu) ?? []).length, 1)
    assert.equal((emergencyParity.match(/^  vantage-us:/gmu) ?? []).length, 1)
  })

  it('passes immutable artifact IDs between release jobs so failed-job retries cannot drift attempts', () => {
    const release = workflow('vercel-production-release.yml')
    assert.match(release, /stage_artifact_id: \$\{\{ steps\.upload-stage-evidence\.outputs\.artifact-id \}\}/)
    assert.match(release, /parity_artifact_id: \$\{\{ steps\.upload-staged-parity\.outputs\.artifact-id \}\}/)
    assert.match(release, /approval_artifact_id: \$\{\{ steps\.upload-promotion-approval\.outputs\.artifact-id \}\}/)
    assert.match(release, /artifact-ids: \$\{\{ needs\.stage\.outputs\.stage_artifact_id \}\},\$\{\{ needs\.staged-parity\.outputs\.parity_artifact_id \}\}/)
    assert.match(release, /artifact-ids: \$\{\{ needs\.stage\.outputs\.stage_artifact_id \}\},\$\{\{ needs\.staged-parity\.outputs\.parity_artifact_id \}\},\$\{\{ needs\.promotion-approval\.outputs\.approval_artifact_id \}\}/)
    assert.doesNotMatch(release, /pattern: vercel-(?:stage|\*)/)
  })

  it('bounds transient attestation verification retries without weakening verifier arguments', () => {
    const release = workflow('vercel-production-release.yml')
    const wrapper = readFileSync(
      new URL('../../scripts/security/verify-gh-attestation-with-retry.sh', import.meta.url),
      'utf8',
    )
    assert.match(wrapper, /for attempt in 1 2 3/)
    assert.match(wrapper, /gh attestation verify "\$@"/)
    assert.match(wrapper, /sleep "\$\(\(attempt \* 5\)\)"/)
    assert.match(wrapper, /failed after three bounded attempts/)
    assert.ok((release.match(/for attempt in 1 2 3/g) ?? []).length >= 6)
    assert.ok((release.match(/sleep "\$\(\(attempt \* 5\)\)"/g) ?? []).length >= 6)
    assert.match(release, /Exact release-input attestation verification failed after three bounded attempts/)
  })

  it('bootstraps the exact reviewed GitHub CLI archive independently of mutable runner images', () => {
    const bootstrap = readFileSync(
      new URL('../../scripts/security/use-reviewed-gh.sh', import.meta.url),
      'utf8',
    )
    assert.match(bootstrap, /reviewed_gh_version="2\.96\.0"/)
    assert.match(bootstrap, /83d5c2ccad5498f58bf6368acb1ab32588cf43ab3a4b1c301bf36328b1c8bd60/)
    assert.match(bootstrap, /56b8bbbb27b066ecb33dbef9a256dc9d1314adaeff0908a752feba6c34053b40/)
    assert.match(bootstrap, /github\.com\/cli\/cli\/releases\/download\/v\$\{reviewed_gh_version\}/)
    assert.match(bootstrap, /sha256sum --check --strict/)
    assert.match(bootstrap, /--no-same-owner --no-same-permissions/)
    assert.match(bootstrap, /test ! -L "\$reviewed_gh_binary"/)
    assert.doesNotMatch(bootstrap, /latest|\.curlrc|\bnpx\b|npm exec/)
  })

  it('prints each release evidence digest once', () => {
    const adapter = readFileSync(
      new URL('../../scripts/security/vercel-rest-release.mjs', import.meta.url),
      'utf8',
    )
    assert.equal((adapter.match(/process\.stdout\.write\(`\$\{label\}:/g) ?? []).length, 1)
  })
})

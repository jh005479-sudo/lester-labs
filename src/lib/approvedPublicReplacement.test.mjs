import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getContractAddress } from 'viem'

import {
  DEPLOYMENTS,
  LEGACY_ADDRESSES,
  LEGACY_RUNTIME_HASHES,
  REVIEWED_PARAMETERS,
  canonicalApprovalPayloadSha256,
  canonicalManifestSha256,
  verifyApprovedPublicReplacementPackage,
} from '../../scripts/security/verify-approved-public-replacement.mjs'
import { assertExactApprovedPublicReplacementPackageShape } from '../config/contracts.ts'

const HASH_A = `0x${'11'.repeat(32)}`
const HASH_B = `0x${'22'.repeat(32)}`
const CONTROLLER = '0x1000000000000000000000000000000000000001'
const TREASURY = '0x2000000000000000000000000000000000000002'
const GAS_ONLY_DEPLOYER = '0x3000000000000000000000000000000000000003'
function makeApprovedFixture() {
  const deploymentManifest = {
    kind: 'lester-labs-post-compromise-replacement',
    schemaVersion: 2,
    chainId: '4441',
    deploymentProfile: 'production-separated-authority',
    controller: CONTROLLER,
    treasury: TREASURY,
    parameters: { ...REVIEWED_PARAMETERS },
    planHash: HASH_A,
    buildAttestationSha256: HASH_A,
    buildSourceCommit: '1'.repeat(40),
    gasOnlyDeployer: GAS_ONLY_DEPLOYER,
    startingNonce: 0,
    confirmations: 1,
    legacyRecovery: {
      addresses: { ...LEGACY_ADDRESSES },
      runtimeCodeHashes: { ...LEGACY_RUNTIME_HASHES },
      iloFactoryProvenance: [
        {
          label: 'production-build-hidden-factory',
          address: LEGACY_ADDRESSES.productionBuildIloFactory,
          runtimeCodeHash: LEGACY_RUNTIME_HASHES.productionBuildIloFactory,
          observedChildCount: '8330',
          observedOn: '2026-08-04',
        },
        {
          label: 'canonical-legacy-factory',
          address: LEGACY_ADDRESSES.iloFactory,
          runtimeCodeHash: LEGACY_RUNTIME_HASHES.iloFactory,
          observedChildCount: '121',
          observedOn: '2026-08-04',
        },
      ],
    },
    deployments: DEPLOYMENTS.map(([name, artifact], nonce) => ({
      name,
      artifact,
      address: getContractAddress({ from: GAS_ONLY_DEPLOYER, nonce: BigInt(nonce) }),
      nonce,
      transactionHash: `0x${(nonce + 1).toString(16).padStart(64, '0')}`,
      blockNumber: nonce + 1,
      runtimeCodeHash: HASH_A,
      runtimeCodeBytes: 1,
    })),
    verifiedAtBlock: 13,
  }
  const value = {
    status: 'APPROVED',
    approvalPayloadSha256: '',
    deploymentManifestSha256: canonicalManifestSha256(deploymentManifest),
    deploymentManifest,
    frontendRuntimeAttestations: {
      uniswapV2Pair: HASH_A,
      vestingWallet: {
        normalizedRuntimeCodeHash: HASH_B,
        runtimeCodeBytes: 96,
        immutableReferences: [{ start: 12, length: 32 }],
      },
      iloChild: HASH_B,
    },
    activityCutover: {
      throughBlock: 123,
      blockHash: HASH_A,
      totals: {
        tokensMinted: 1,
        walletsAirdropped: 2,
        presalesCreated: 3,
        swapsCompleted: 4,
        onChainMessages: 5,
      },
    },
  }
  value.approvalPayloadSha256 = canonicalApprovalPayloadSha256(value)
  return value
}

describe('approved public replacement package', () => {
  it('keeps the checked-in sentinel fail-closed until production evidence exists', () => {
    assert.deepEqual(verifyApprovedPublicReplacementPackage(), { status: 'NOT_APPROVED' })
  })

  it('uses deterministic pretty-JSON plus newline for manifest evidence digests', () => {
    assert.equal(
      canonicalManifestSha256({ chainId: '4441', deployments: [] }),
      '0x6553d327a2343b1b72eae66be28953c8f9bb4efa538cfb3e3c2001119067ac7c',
    )
  })

  it('binds child-runtime attestations, cutover identity, and baseline totals into one digest', () => {
    const directory = mkdtempSync(join(tmpdir(), 'lester-public-approval-'))
    const packagePath = join(directory, 'approved.json')
    try {
      const approved = makeApprovedFixture()
      writeFileSync(packagePath, `${JSON.stringify(approved, null, 2)}\n`)
      assert.deepEqual(verifyApprovedPublicReplacementPackage(packagePath), {
        status: 'APPROVED',
        approvalPayloadSha256: approved.approvalPayloadSha256,
        deploymentManifestSha256: approved.deploymentManifestSha256,
      })

      const mutations = [
        (value) => { value.frontendRuntimeAttestations.uniswapV2Pair = HASH_B },
        (value) => { value.frontendRuntimeAttestations.vestingWallet.immutableReferences[0].start = 13 },
        (value) => { value.activityCutover.throughBlock = 124 },
        (value) => { value.activityCutover.totals.tokensMinted = 2 },
      ]
      for (const mutate of mutations) {
        const altered = structuredClone(approved)
        mutate(altered)
        writeFileSync(packagePath, `${JSON.stringify(altered, null, 2)}\n`)
        assert.throws(
          () => verifyApprovedPublicReplacementPackage(packagePath),
          /public replacement payload digest/i,
        )
      }
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('rejects omitted or unreviewed nested approval fields before address activation', () => {
    const approved = makeApprovedFixture()
    assert.doesNotThrow(() => assertExactApprovedPublicReplacementPackageShape(approved))

    const mutations = [
      (value) => { value.deploymentManifest.unreviewed = true },
      (value) => { delete value.deploymentManifest.legacyRecovery },
      (value) => { value.deploymentManifest.deployments[0].extra = 'redirect' },
      (value) => { value.frontendRuntimeAttestations.vestingWallet.immutableReferences[0].extra = 1 },
      (value) => { value.activityCutover.totals.unreviewed = 1 },
    ]
    for (const mutate of mutations) {
      const altered = structuredClone(approved)
      mutate(altered)
      assert.throws(
        () => assertExactApprovedPublicReplacementPackageShape(altered),
        /exactly the reviewed fields|legacy-recovery inventory/i,
      )
    }
  })

  it('rejects fully rehashed malformed and disposable packages in the standalone release gate', () => {
    const directory = mkdtempSync(join(tmpdir(), 'lester-public-semantics-'))
    const packagePath = join(directory, 'approved.json')
    const rehash = (value) => {
      value.deploymentManifestSha256 = canonicalManifestSha256(value.deploymentManifest)
      value.approvalPayloadSha256 = canonicalApprovalPayloadSha256(value)
    }
    try {
      const malformed = makeApprovedFixture()
      malformed.deploymentManifest.deployments[0].extra = 'unreviewed'
      rehash(malformed)
      writeFileSync(packagePath, `${JSON.stringify(malformed, null, 2)}\n`)
      assert.throws(
        () => verifyApprovedPublicReplacementPackage(packagePath),
        /exactly the reviewed fields/i,
      )

      const disposable = makeApprovedFixture()
      disposable.deploymentManifest.deploymentProfile = 'testnet-immutable-disposable'
      disposable.deploymentManifest.controller = '0x0000000000000000000000000000000000000001'
      disposable.deploymentManifest.treasury = '0xCbf819017ae48F261Fe143B2a7c8a29d9a2FCD28'
      disposable.deploymentManifest.gasOnlyDeployer = disposable.deploymentManifest.treasury
      disposable.deploymentManifest.deployments.forEach((deployment, nonce) => {
        deployment.address = getContractAddress({
          from: disposable.deploymentManifest.gasOnlyDeployer,
          nonce: BigInt(nonce),
        })
      })
      rehash(disposable)
      writeFileSync(packagePath, `${JSON.stringify(disposable, null, 2)}\n`)
      assert.throws(
        () => verifyApprovedPublicReplacementPackage(packagePath),
        /production-separated-authority/i,
      )

      const zeroRole = makeApprovedFixture()
      zeroRole.deploymentManifest.controller = '0x0000000000000000000000000000000000000000'
      rehash(zeroRole)
      writeFileSync(packagePath, `${JSON.stringify(zeroRole, null, 2)}\n`)
      assert.throws(
        () => verifyApprovedPublicReplacementPackage(packagePath),
        /distinct fresh addresses/i,
      )

      const recasedLegacy = makeApprovedFixture()
      recasedLegacy.deploymentManifest.legacyRecovery.addresses.iloFactory =
        recasedLegacy.deploymentManifest.legacyRecovery.addresses.iloFactory.toUpperCase().replace('0X', '0x')
      rehash(recasedLegacy)
      writeFileSync(packagePath, `${JSON.stringify(recasedLegacy, null, 2)}\n`)
      assert.throws(
        () => verifyApprovedPublicReplacementPackage(packagePath),
        /legacy-recovery inventory differs/i,
      )
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})

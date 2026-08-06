import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  APPROVED_ILO_CREATION_FACTORY_ADDRESS,
  APPROVED_LESTER_TREASURY_ADDRESS,
  LITVM_LEGACY_ILO_FACTORIES,
  hasApprovedIloPaidWritePath,
  isApprovedIloCreationFactory,
  isApprovedLesterTreasury,
  isCanonicalLitvmContract,
  POST_COMPROMISE_REPLACEMENTS_ACTIVE,
  LITVM_TESTNET_CONTRACTS,
} from '../config/contracts.ts'

describe('launchpad contract provenance', () => {
  it('pins both legacy ILO recovery sources and reconciles the preserved production count', () => {
    assert.deepEqual(
      LITVM_LEGACY_ILO_FACTORIES.map((deployment) => deployment.address.toLowerCase()),
      [
        '0xc9b1961def0cc5bc1ffe3cfe37a4988d7987a43f',
        '0xa533bbe87bdcd91e4367de517e99bf8ba75fd0ab',
      ],
    )
    assert.equal(
      LITVM_LEGACY_ILO_FACTORIES.reduce((total, deployment) => total + deployment.countAtProvisionalFloor, 0),
      8_451,
    )
    assert.deepEqual(
      LITVM_LEGACY_ILO_FACTORIES.map((deployment) => deployment.runtimeCodeHash),
      [
        '0xed56b878c6c936b7a54c0fc501a87cd96dc185e8d0967759df88817a03bc2dd5',
        '0x9c52ccc3cf932eeff5f19c65d7055f9c8eaa50b68e64a1e1e6bafebaf0e81b9a',
      ],
    )
    assert.deepEqual(
      LITVM_LEGACY_ILO_FACTORIES.map((deployment) => deployment.childRuntimeCodeHash),
      [
        '0xa89b7cc62a2d277f3019ec31316c4aac0f034684e191ee98b0bfdf00492eeb5f',
        '0x8359d3e7011bea1f23fad4d454c093a32271b7e2b2078f190a0c0add87598fca',
      ],
    )
    assert.deepEqual(
      LITVM_LEGACY_ILO_FACTORIES.map((deployment) => deployment.connectorRuntimeCodeHash),
      ['0xddb0ce4525768177261872afa458a433d0fb2a312d23325c46fabc29d398ed4e', undefined],
    )
  })

  it('accepts only the canonical LitVM factory address regardless of casing', () => {
    assert.equal(
      isCanonicalLitvmContract(
        LITVM_TESTNET_CONTRACTS.iloFactory.toLowerCase(),
        LITVM_TESTNET_CONTRACTS.iloFactory,
      ),
      true,
    )
    assert.equal(
      isCanonicalLitvmContract('0x0000000000000000000000000000000000000001', LITVM_TESTNET_CONTRACTS.iloFactory),
      false,
    )
    assert.equal(isCanonicalLitvmContract(undefined, LITVM_TESTNET_CONTRACTS.iloFactory), false)
  })

  it('fails every treasury gate closed until a reviewed replacement is activated', () => {
    assert.equal(POST_COMPROMISE_REPLACEMENTS_ACTIVE, false)
    assert.equal(APPROVED_LESTER_TREASURY_ADDRESS, undefined)
    assert.equal(isApprovedLesterTreasury('0xCbf819017ae48F261Fe143B2a7c8a29d9a2FCD28'), false)
    assert.equal(isApprovedLesterTreasury('0xDD221FBbCb0f6092AfE51183d964AA89A968eE13'), false)
    assert.equal(isApprovedLesterTreasury(undefined), false)
  })

  it('never enables creation through the canonical legacy factory or an environment-selected address', () => {
    assert.equal(APPROVED_ILO_CREATION_FACTORY_ADDRESS, undefined)
    assert.equal(isApprovedIloCreationFactory(LITVM_TESTNET_CONTRACTS.iloFactory), false)
    assert.equal(isApprovedIloCreationFactory('0x1111111111111111111111111111111111111111'), false)
    assert.equal(isApprovedIloCreationFactory(undefined), false)
  })

  it('keeps every source-pinned legacy-factory child recovery-only before cutover', () => {
    assert.equal(
      hasApprovedIloPaidWritePath({
        factory: LITVM_TESTNET_CONTRACTS.iloFactory,
        treasury: '0x1111111111111111111111111111111111111111',
      }),
      false,
    )
    assert.equal(
      hasApprovedIloPaidWritePath({
        factory: '0x1111111111111111111111111111111111111111',
        treasury: '0x1111111111111111111111111111111111111111',
      }),
      false,
    )
  })

  it('attests only the factory reported by the child and keeps current/legacy provenance distinct', () => {
    const source = readFileSync(new URL('./launchpadProvenance.ts', import.meta.url), 'utf8')
    assert.match(source, /const source = iloSources\(\)\.find/)
    assert.match(source, /isCanonicalLitvmContract\(childFactory, candidate\.address\)/)
    assert.match(source, /requiredKind\?: 'any' \| 'current' \| 'legacy'/)
    assert.match(source, /sourceKind: source\.kind/)
    assert.doesNotMatch(source, /Promise\.all\(LITVM_LEGACY_ILO_FACTORIES\.map/)
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assertRecoveryFrontendWriteAllowed,
  evaluateStandardFrontendWrite,
} from './frontendWritePolicy.ts'

const addresses = {
  account: '0x1000000000000000000000000000000000000001',
  tokenFactory: '0x1000000000000000000000000000000000000002',
  vestingFactory: '0x1000000000000000000000000000000000000003',
  liquidityLocker: '0x1000000000000000000000000000000000000004',
  disperse: '0x1000000000000000000000000000000000000005',
  ledger: '0x1000000000000000000000000000000000000006',
  uniswapV2Factory: '0x1000000000000000000000000000000000000007',
  uniswapV2Router: '0x1000000000000000000000000000000000000008',
  wrappedZkLtc: '0x1000000000000000000000000000000000000009',
  iloFactory: '0x100000000000000000000000000000000000000a',
  iloConnector: '0x100000000000000000000000000000000000000b',
  iloChild: '0x100000000000000000000000000000000000000c',
  selectedToken: '0x100000000000000000000000000000000000000d',
  secondToken: '0x100000000000000000000000000000000000000e',
  governor: '0x100000000000000000000000000000000000000f',
  governanceToken: '0x1000000000000000000000000000000000000010',
  timelock: '0x1000000000000000000000000000000000000011',
  attacker: '0x1000000000000000000000000000000000000012',
}

const hashes = Object.freeze({
  tokenFactory: `0x${'01'.repeat(32)}`,
  vestingFactory: `0x${'02'.repeat(32)}`,
  liquidityLocker: `0x${'03'.repeat(32)}`,
  disperse: `0x${'04'.repeat(32)}`,
  ledger: `0x${'05'.repeat(32)}`,
  uniswapV2Factory: `0x${'06'.repeat(32)}`,
  uniswapV2Router: `0x${'07'.repeat(32)}`,
  uniswapV2Pair: `0x${'08'.repeat(32)}`,
  wrappedZkLtc: `0x${'09'.repeat(32)}`,
})

const now = 2_000_000_000n
const activeConfiguration = Object.freeze({
  replacementsActive: true,
  governanceActive: true,
  nowSeconds: now,
  contracts: {
    tokenFactory: addresses.tokenFactory,
    vestingFactory: addresses.vestingFactory,
    liquidityLocker: addresses.liquidityLocker,
    disperse: addresses.disperse,
    ledger: addresses.ledger,
    uniswapV2Factory: addresses.uniswapV2Factory,
    uniswapV2Router: addresses.uniswapV2Router,
    wrappedZkLtc: addresses.wrappedZkLtc,
  },
  runtimeCodeHashes: hashes,
  approvedIlo: {
    factory: addresses.iloFactory,
    factoryRuntimeCodeHash: `0x${'0a'.repeat(32)}`,
    childRuntimeCodeHash: `0x${'0b'.repeat(32)}`,
    connector: addresses.iloConnector,
    connectorRuntimeCodeHash: `0x${'0c'.repeat(32)}`,
  },
  governance: {
    token: addresses.governanceToken,
    governor: addresses.governor,
    timelock: addresses.timelock,
    tokenRuntimeCodeHash: `0x${'0d'.repeat(32)}`,
    governorRuntimeCodeHash: `0x${'0e'.repeat(32)}`,
    timelockRuntimeCodeHash: `0x${'0f'.repeat(32)}`,
  },
  retiredTargets: ['0x2000000000000000000000000000000000000001'],
})

function evaluate(intent, provenance) {
  return evaluateStandardFrontendWrite(intent, addresses.account, provenance, activeConfiguration)
}

describe('explicit standard frontend write capabilities', () => {
  it('accepts exact fixed-target capabilities and returns runtime attestations', () => {
    const tokenDecision = evaluate({
      address: addresses.tokenFactory,
      functionName: 'createToken',
      args: ['Reviewed Token', 'RVT', 1_000_000n, 18, false, true, false],
      value: 30_000_000_000_000_000n,
    })
    assert.deepEqual(tokenDecision.runtimeAttestations, [{
      address: addresses.tokenFactory,
      expectedRuntimeCodeHash: hashes.tokenFactory,
      label: 'TokenFactory',
    }])

    assert.doesNotThrow(() => evaluate({
      address: addresses.ledger,
      functionName: 'post',
      args: ['0x68656c6c6f'],
      value: 10_000_000_000_000_000n,
    }))
    assert.doesNotThrow(() => evaluate({
      address: addresses.disperse,
      functionName: 'disperseEther',
      args: [[addresses.account], [5n]],
      value: 5n,
    }))
  })

  it('accepts only exact approval spenders and finite positive amounts', () => {
    assert.doesNotThrow(() => evaluate({
      address: addresses.selectedToken,
      functionName: 'approve',
      args: [addresses.uniswapV2Router, 100n],
    }))
    assert.throws(() => evaluate({
      address: addresses.selectedToken,
      functionName: 'approve',
      args: [addresses.attacker, 100n],
    }), /spender/i)
    assert.throws(() => evaluate({
      address: addresses.selectedToken,
      functionName: 'approve',
      args: [addresses.uniswapV2Router, (1n << 256n) - 1n],
    }), /bounded/i)
  })

  it('binds swap proceeds to the connected wallet and constrains path/deadline/value', () => {
    assert.doesNotThrow(() => evaluate({
      address: addresses.uniswapV2Router,
      functionName: 'swapExactETHForTokens',
      args: [1n, [addresses.wrappedZkLtc, addresses.selectedToken], addresses.account, now + 600n],
      value: 10n,
    }))
    assert.throws(() => evaluate({
      address: addresses.uniswapV2Router,
      functionName: 'swapExactETHForTokens',
      args: [1n, [addresses.wrappedZkLtc, addresses.selectedToken], addresses.attacker, now + 600n],
      value: 10n,
    }), /connected wallet/i)
    assert.throws(() => evaluate({
      address: addresses.uniswapV2Router,
      functionName: 'swapExactETHForTokens',
      args: [1n, [addresses.wrappedZkLtc, addresses.selectedToken], addresses.account, now + 10_000n],
      value: 10n,
    }), /two hours/i)
  })

  it('requires an exact current-factory provenance claim for every dynamic ILO child write', () => {
    const claim = {
      kind: 'current-ilo-child',
      child: addresses.iloChild,
      sourceFactory: addresses.iloFactory,
    }
    assert.doesNotThrow(() => evaluate({
      address: addresses.iloChild,
      functionName: 'contribute',
      args: [],
      value: 10n,
    }, claim))
    assert.doesNotThrow(() => evaluate({
      address: addresses.selectedToken,
      functionName: 'transfer',
      args: [addresses.iloChild, 100n],
    }, claim))
    assert.throws(() => evaluate({
      address: addresses.attacker,
      functionName: 'contribute',
      args: [],
      value: 10n,
    }, claim), /does not match/i)
    assert.throws(() => evaluate({
      address: addresses.iloChild,
      functionName: 'contribute',
      args: [],
      value: 10n,
    }), /provenance claim/i)
  })

  it('pins ILO creation to the exact factory/connector/router runtimes and bounded sale terms', () => {
    const result = evaluate({
      address: addresses.iloFactory,
      functionName: 'createILO',
      args: [
        addresses.selectedToken,
        10n,
        100n,
        1_000n,
        now + 60n,
        now + 86_400n,
        5_100n,
        30n * 24n * 60n * 60n,
        false,
      ],
      value: 30_000_000_000_000_000n,
    })
    assert.equal(result.attestApprovedIloFactoryRouting, true)
    assert.deepEqual(
      result.runtimeAttestations.slice(0, 4).map((entry) => entry.address),
      [addresses.iloFactory, addresses.iloConnector, addresses.uniswapV2Router, addresses.uniswapV2Factory],
    )
    assert.throws(() => evaluate({
      address: addresses.iloFactory,
      functionName: 'createILO',
      args: [addresses.selectedToken, 100n, 10n, 1n, now + 60n, now + 120n, 5_100n, 2_592_000n, false],
      value: 1n,
    }), /caps or sale times/i)
  })

  it('rejects arbitrary targets, arbitrary functions, native value on nonpayable calls, and retired targets', () => {
    assert.throws(() => evaluate({
      address: addresses.attacker,
      functionName: 'harvestWallet',
      args: [],
    }), /not permitted/i)
    assert.throws(() => evaluate({
      address: addresses.tokenFactory,
      functionName: 'setTreasury',
      args: [addresses.attacker],
    }), /not permitted/i)
    assert.throws(() => evaluate({
      address: addresses.disperse,
      functionName: 'disperseToken',
      args: [addresses.selectedToken, [addresses.account], [1n]],
      value: 1n,
    }), /cannot send native value/i)
    assert.throws(() => evaluate({
      address: activeConfiguration.retiredTargets[0],
      functionName: 'approve',
      args: [addresses.uniswapV2Router, 1n],
    }), /retired/i)
  })
})

describe('recovery capability shapes', () => {
  it('requires a provenance claim and separates claimant from owner-only ILO recovery', () => {
    const claim = {
      kind: 'ilo-child',
      sourceFactory: addresses.iloFactory,
      child: addresses.iloChild,
      role: 'claimant',
    }
    assert.doesNotThrow(() => assertRecoveryFrontendWriteAllowed({
      address: addresses.iloChild,
      functionName: 'claim',
    }, addresses.account, claim))
    assert.throws(() => assertRecoveryFrontendWriteAllowed({
      address: addresses.iloChild,
      functionName: 'sweepExcessETH',
    }, addresses.account, claim), /not permitted/i)
    assert.doesNotThrow(() => assertRecoveryFrontendWriteAllowed({
      address: addresses.iloChild,
      functionName: 'cancel',
    }, addresses.account, { ...claim, role: 'owner' }))
    assert.throws(() => assertRecoveryFrontendWriteAllowed({
      address: addresses.iloChild,
      functionName: 'claim',
    }, addresses.account), /provenance/i)
  })

  it('binds vesting recovery to receipt-attested child/token data and rejects native value', () => {
    const claim = {
      kind: 'vesting-wallet',
      sourceFactory: addresses.vestingFactory,
      child: addresses.iloChild,
      creationTxHash: `0x${'12'.repeat(32)}`,
      beneficiary: addresses.account,
      token: addresses.selectedToken,
    }
    assert.doesNotThrow(() => assertRecoveryFrontendWriteAllowed({
      address: addresses.iloChild,
      functionName: 'release',
      args: [addresses.selectedToken],
    }, addresses.account, claim))
    assert.throws(() => assertRecoveryFrontendWriteAllowed({
      address: addresses.iloChild,
      functionName: 'release',
      args: [addresses.secondToken],
    }, addresses.account, claim), /not permitted/i)
    assert.throws(() => assertRecoveryFrontendWriteAllowed({
      address: addresses.iloChild,
      functionName: 'release',
      args: [addresses.selectedToken],
      value: 1n,
    }, addresses.account, claim), /cannot send native value/i)
  })

  it('binds LP removal to the claimed pair/router, connected recipient, and a short future deadline', () => {
    const deadline = BigInt(Math.floor(Date.now() / 1_000)) + 600n
    const claim = {
      kind: 'dex-liquidity',
      deploymentId: 'current',
      pair: addresses.iloChild,
      router: addresses.uniswapV2Router,
      tokenA: addresses.selectedToken,
      tokenB: addresses.secondToken,
    }
    assert.doesNotThrow(() => assertRecoveryFrontendWriteAllowed({
      address: addresses.uniswapV2Router,
      functionName: 'removeLiquidity',
      args: [addresses.selectedToken, addresses.secondToken, 10n, 1n, 1n, addresses.account, deadline],
    }, addresses.account, claim))
    assert.throws(() => assertRecoveryFrontendWriteAllowed({
      address: addresses.uniswapV2Router,
      functionName: 'removeLiquidity',
      args: [addresses.selectedToken, addresses.secondToken, 10n, 1n, 1n, addresses.attacker, deadline],
    }, addresses.account, claim), /connected wallet/i)
    assert.throws(() => assertRecoveryFrontendWriteAllowed({
      address: addresses.uniswapV2Router,
      functionName: 'removeLiquidity',
      args: [addresses.selectedToken, addresses.secondToken, 10n, 1n, 1n, addresses.account, deadline + 10_000n],
    }, addresses.account, claim), /next two hours/i)
  })
})

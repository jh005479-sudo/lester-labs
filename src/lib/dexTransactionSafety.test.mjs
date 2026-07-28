import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applySlippageMinimum,
  assertCanonicalPair,
  assertCanonicalRouterRuntime,
  computeAddLiquidityMinimums,
  computeRemoveLiquidityMinimums,
  hasCanonicalDexTargets,
} from './dexTransactionSafety.ts'

const canonical = {
  factory: '0x1111111111111111111111111111111111111111',
  router: '0x2222222222222222222222222222222222222222',
  wrappedNative: '0x3333333333333333333333333333333333333333',
}
const approvedTreasury = '0x9999999999999999999999999999999999999999'

describe('DEX transaction target authentication', () => {
  it('accepts only the canonical configured deployment and router wiring', () => {
    assert.equal(hasCanonicalDexTargets(canonical, canonical), true)
    assert.doesNotThrow(() =>
      assertCanonicalRouterRuntime(
        canonical,
        canonical,
        canonical.factory,
        canonical.wrappedNative,
        approvedTreasury,
        approvedTreasury,
        approvedTreasury,
      ),
    )
  })

  it('rejects an environment-overridden router and mismatched runtime wiring', () => {
    assert.throws(
      () => assertCanonicalRouterRuntime(
        { ...canonical, router: '0x4444444444444444444444444444444444444444' },
        canonical,
        canonical.factory,
        canonical.wrappedNative,
        approvedTreasury,
        approvedTreasury,
        approvedTreasury,
      ),
      /not the canonical LitVM deployment/,
    )
    assert.throws(
      () => assertCanonicalRouterRuntime(
        canonical,
        canonical,
        '0x5555555555555555555555555555555555555555',
        canonical.wrappedNative,
        approvedTreasury,
        approvedTreasury,
        approvedTreasury,
      ),
      /could not be authenticated/,
    )
  })

  it('fails closed unless feeTo and feeToSetter both match the approved treasury', () => {
    const retiredTreasury = '0x8888888888888888888888888888888888888888'
    assert.throws(
      () => assertCanonicalRouterRuntime(
        canonical,
        canonical,
        canonical.factory,
        canonical.wrappedNative,
        retiredTreasury,
        approvedTreasury,
        approvedTreasury,
      ),
      /fee controls are not assigned/,
    )
    assert.throws(
      () => assertCanonicalRouterRuntime(
        canonical,
        canonical,
        canonical.factory,
        canonical.wrappedNative,
        approvedTreasury,
        retiredTreasury,
        approvedTreasury,
      ),
      /fee controls are not assigned/,
    )
    assert.throws(
      () => assertCanonicalRouterRuntime(
        canonical,
        canonical,
        canonical.factory,
        canonical.wrappedNative,
        approvedTreasury,
        undefined,
        approvedTreasury,
      ),
      /fee controls are not assigned/,
    )
  })

  it('rejects a query-supplied pair unless the factory and pair token set agree', () => {
    const pair = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const tokenA = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    const tokenB = '0xcccccccccccccccccccccccccccccccccccccccc'
    assert.doesNotThrow(() => assertCanonicalPair(pair, pair, tokenA, tokenB, tokenB, tokenA))
    assert.throws(
      () => assertCanonicalPair(pair, '0xdddddddddddddddddddddddddddddddddddddddd', tokenA, tokenB, tokenA, tokenB),
      /not registered/,
    )
    assert.throws(
      () => assertCanonicalPair(pair, pair, tokenA, tokenB, tokenA, canonical.wrappedNative),
      /metadata does not match/,
    )
  })
})

describe('DEX slippage minima', () => {
  it('requires positive quotes and explicit bounded slippage', () => {
    assert.equal(applySlippageMinimum(1_000n, 50n), 995n)
    assert.throws(() => applySlippageMinimum(1_000n, 0n), /greater than 0%/)
    assert.throws(() => applySlippageMinimum(0n, 50n), /positive fresh quote/)
    assert.throws(() => applySlippageMinimum(1n, 50n), /too small/)
  })

  it('derives add-liquidity minima from authenticated reserves', () => {
    assert.deepEqual(
      computeAddLiquidityMinimums({
        desiredA: 1_000n,
        desiredB: 3_000n,
        reserveA: 10_000n,
        reserveB: 20_000n,
        slippageBps: 50n,
      }),
      { amountAMin: 995n, amountBMin: 1_990n },
    )
    assert.throws(
      () => computeAddLiquidityMinimums({ desiredA: 1_000n, desiredB: 1_000n, reserveA: 1n, reserveB: 0n, slippageBps: 50n }),
      /one-sided reserve/,
    )
  })

  it('never emits zero removal minima from an unusable quote', () => {
    assert.deepEqual(
      computeRemoveLiquidityMinimums({
        reserve0: 10_000n,
        reserve1: 20_000n,
        totalSupply: 1_000n,
        liquidity: 100n,
        slippageBps: 50n,
      }),
      { expected0: 1_000n, expected1: 2_000n, amount0Min: 995n, amount1Min: 1_990n },
    )
    assert.throws(
      () => computeRemoveLiquidityMinimums({ reserve0: 1n, reserve1: 1n, totalSupply: 1_000n, liquidity: 1n, slippageBps: 50n }),
      /positive fresh quote/,
    )
  })
})

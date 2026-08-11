import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  assertLitvmChainId,
  assertLitvmWalletChainSnapshot,
  assertRequestedLitvmChainId,
  runGuardedLitvmWalletPrompt,
} from './litvmChainPolicy.ts'

const account = '0x1111111111111111111111111111111111111111'

describe('LitVM wallet chain guard', () => {
  it('accepts only exact chain ID 4441 and rejects wrong or unknown required chain IDs', () => {
    assert.doesNotThrow(() => assertLitvmChainId(4441))
    for (const chainId of [undefined, null, 0, 1, 4441n, '4441', 44_441]) {
      assert.throws(() => assertLitvmChainId(chainId), /4441/)
    }

    assert.doesNotThrow(() => assertRequestedLitvmChainId(undefined))
    assert.doesNotThrow(() => assertRequestedLitvmChainId(4441))
    assert.throws(() => assertRequestedLitvmChainId(1), /unapproved chain/i)
    assert.throws(() => assertRequestedLitvmChainId('4441'), /unapproved chain/i)
  })

  it('requires connected app state, connector RPC state, and account state to agree', () => {
    const validSnapshot = {
      connected: true,
      stateChainId: 4441,
      connectorChainId: 4441,
      connectedAddress: account,
      connectorAccounts: [account],
      expectedAddress: account,
    }
    assert.doesNotThrow(() => assertLitvmWalletChainSnapshot(validSnapshot))

    assert.throws(() => assertLitvmWalletChainSnapshot({ ...validSnapshot, connected: false }), /Connect a wallet/)
    assert.throws(() => assertLitvmWalletChainSnapshot({ ...validSnapshot, stateChainId: undefined }), /both report/)
    assert.throws(() => assertLitvmWalletChainSnapshot({ ...validSnapshot, connectorChainId: undefined }), /both report/)
    assert.throws(() => assertLitvmWalletChainSnapshot({ ...validSnapshot, stateChainId: 1 }), /both report/)
    assert.throws(() => assertLitvmWalletChainSnapshot({ ...validSnapshot, connectorChainId: 1 }), /both report/)
    assert.throws(() => assertLitvmWalletChainSnapshot({
      ...validSnapshot,
      expectedAddress: undefined,
      connectorAccounts: [],
    }), /account state do not agree/)
    assert.throws(() => assertLitvmWalletChainSnapshot({
      ...validSnapshot,
      connectedAddress: '0x2222222222222222222222222222222222222222',
    }), /account changed/)
    assert.throws(() => assertLitvmWalletChainSnapshot({
      ...validSnapshot,
      connectorAccounts: ['0x2222222222222222222222222222222222222222'],
    }), /no longer exposes/)
  })

  it('never reaches preflight or a wallet prompt for an explicitly wrong requested chain', async () => {
    const calls = []
    await assert.rejects(() => runGuardedLitvmWalletPrompt({
      requestedChainId: 1,
      attestWalletChain: async () => { calls.push('chain') },
      preflight: async () => { calls.push('preflight') },
      prompt: async () => { calls.push('prompt'); return 'hash' },
    }), /unapproved chain/i)
    assert.deepEqual(calls, [])
  })

  it('never prompts when the initial connector chain is wrong or unknown', async () => {
    for (const connectorChainId of [1, undefined]) {
      const calls = []
      await assert.rejects(() => runGuardedLitvmWalletPrompt({
        attestWalletChain: async () => {
          calls.push('chain')
          assertLitvmWalletChainSnapshot({
            connected: true,
            stateChainId: 4441,
            connectorChainId,
            connectedAddress: account,
            connectorAccounts: [account],
          })
        },
        preflight: async () => { calls.push('preflight') },
        prompt: async () => { calls.push('prompt'); return 'hash' },
      }), /both report/)
      assert.deepEqual(calls, ['chain'])
    }
  })

  it('catches a stale-chain race after preflight and before the wallet prompt', async () => {
    const calls = []
    let chainRead = 0
    await assert.rejects(() => runGuardedLitvmWalletPrompt({
      requestedChainId: 4441,
      attestWalletChain: async () => {
        chainRead += 1
        calls.push(`chain-${chainRead}`)
        assertLitvmWalletChainSnapshot({
          connected: true,
          stateChainId: 4441,
          connectorChainId: chainRead === 1 ? 4441 : 1,
          connectedAddress: account,
          connectorAccounts: [account],
        })
      },
      preflight: async () => { calls.push('preflight') },
      prompt: async () => { calls.push('prompt'); return 'hash' },
    }), /both report/)
    assert.deepEqual(calls, ['chain-1', 'preflight', 'chain-2'])
  })

  it('prompts only after both fresh chain checks and preflight succeed', async () => {
    const calls = []
    const result = await runGuardedLitvmWalletPrompt({
      requestedChainId: 4441,
      attestWalletChain: async () => { calls.push('chain') },
      preflight: async () => { calls.push('preflight') },
      prompt: async () => { calls.push('prompt'); return '0xhash' },
    })
    assert.equal(result, '0xhash')
    assert.deepEqual(calls, ['chain', 'preflight', 'chain', 'prompt'])
  })
})

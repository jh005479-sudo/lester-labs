#!/usr/bin/env node
/**
 * Lester Labs — Fee Sweeper
 * Sweeps native token and ERC20 balances from utility contracts to treasury.
 *
 * Usage: node sweep.js [--native-only] [--dry-run]
 *   --native-only : Only sweep native tokens (skip ERC20)
 *   --dry-run     : Print balances without sending
 *
 * Configure TREASURY address and CONTRACTS below before running.
 */

const RPC = 'https://liteforge.rpc.caldera.xyz/http'
const PRIVKEY = process.env.SWEEP_PRIVKEY || '8bdaf07bdbd2157bf6c2054e54e78a4a6a0b9f6c70d6087e6952d7d6a5120f43'
const TREASURY = process.env.TREASURY_ADDRESS || '0xDD221FBbCb0f6092AfE51183d964AA89A968eE13'

// Utility contracts to sweep
const CONTRACTS = {
  'ILOFactory':       '0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB',
  'TokenFactory':     '0x93acc61fcdc2e3407A0c03450Adfd8aE78964948',
  'VestingFactory':   '0x6EE07118D39e9330Ef0658FFA797EeDD2CB823Cf',
  'LiquidityLocker':  '0x80d88C7F529D256e5e6A2CB0e0C30D82bC8827A9',
  'UniswapV2Factory': '0x017A126A44Aaae9273F7963D4E295F0Ee2793AD8',
  'UniswapV2Router':  '0xD56a623890b083d876D47c3b1c5343b7f983FA62',
}

// ERC20 tokens to collect (not wzkLTC — that's handled separately by the unwrap flow)
const ERC20_TOKENS = [
  { name: 'USDT', address: '0x4af16cfb61fe9a2c6d1452d85b25e7ca49748f16' },
  { name: 'USDC', address: '0x7f837D1b20c6ff20d8c6F396760C4F1f1F17baBF' },
  { name: 'WBTC', address: '0x3bce48a3b30414176e796af997bb1ed5e1dc5b22' },
  { name: 'WETH', address: '0xdaf8bdc2b197c2f0fab9d7359bdf482f8332b21f' },
]

const DRY_RUN = process.argv.includes('--dry-run')
const NATIVE_ONLY = process.argv.includes('--native-only')

async function rpc(method, params = []) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const d = await r.json()
  if (d.error) throw new Error(d.error.message)
  return d.result
}

function parseAmount(val, decimals = 18) {
  if (!val || val === '0x') return 0n
  const hex = val.startsWith('0x') ? val.slice(2) : val
  const padded = hex.padStart(64, '0')
  return BigInt('0x' + padded)
}

function formatEth(n) {
  return (Number(n) / 1e18).toFixed(6) + ' zkLTC'
}

async function getNativeBalance(addr) {
  const hex = await rpc('eth_getBalance', [addr, 'latest'])
  return parseAmount(hex)
}

async function getErc20Balance(tokenAddr, holderAddr) {
  const data = '0x70a08231000000000000000000000000' + holderAddr.slice(2)
  const hex = await rpc('eth_call', [{ to: tokenAddr, data }, 'latest'])
  return parseAmount(hex)
}

async function sendNative(to, value) {
  const tx = {
    from: TREASURY,
    to,
    value: '0x' + value.toString(16),
    gas: '0xC350',  // 50000
  }
  const txHash = await rpc('eth_sendTransaction', [tx])
  return txHash
}

async function sendErc20(tokenAddr, to, value) {
  const data = '0xa9059cbb' + to.slice(2).toLowerCase().padStart(64, '0') + value.toString(16).padStart(64, '0')
  const tx = { from: TREASURY, to: tokenAddr, data, gas: '0xC350' }
  return await rpc('eth_sendTransaction', [tx])
}

async function main() {
  console.log('=== Lester Labs — Fee Sweeper ===')
  console.log('Treasury:', TREASURY)
  console.log('Mode:', DRY_RUN ? 'DRY RUN (no txs sent)' : 'LIVE')
  console.log('')

  // Sweep native tokens
  console.log('[Native tokens]')
  const results = []
  for (const [name, addr] of Object.entries(CONTRACTS)) {
    const bal = await getNativeBalance(addr)
    if (bal === 0n) {
      console.log(`  ${name.padEnd(18)} ${addr} → 0 (skip)`)
      continue
    }
    const formatted = formatEth(bal)
    console.log(`  ${name.padEnd(18)} ${addr}`)
    console.log(`    Balance: ${formatted}`)

    if (!DRY_RUN && bal > 21000n) { // keep 1 gas buffer
      try {
        const hash = await sendNative(TREASURY, bal - 21000n)
        console.log(`    Swept → ${hash.slice(0, 18)}... ✓`)
        results.push({ name, addr, swept: formatted, hash })
      } catch (e) {
        console.log(`    ERROR: ${e.message} ✗`)
      }
    } else if (DRY_RUN) {
      results.push({ name, addr, swept: formatted })
    }
  }

  // Sweep ERC20 tokens
  if (!NATIVE_ONLY) {
    console.log('\n[ERC20 tokens]')
    for (const { name, address } of ERC20_TOKENS) {
      const bal = await getErc20Balance(address, TREASURY)
      // Check utility contract balances
      for (const [contractName, contractAddr] of Object.entries(CONTRACTS)) {
        const cBal = await getErc20Balance(address, contractAddr)
        if (cBal === 0n) continue
        console.log(`  ${name} @ ${contractName} (${contractAddr})`)
        console.log(`    Balance: ${(Number(cBal) / 1e18).toFixed(6)} ${name}`)

        if (!DRY_RUN && cBal > 0n) {
          try {
            const hash = await sendErc20(address, TREASURY, cBal)
            console.log(`    Swept → ${hash.slice(0, 18)}... ✓`)
          } catch (e) {
            console.log(`    ERROR: ${e.message} ✗`)
          }
        }
      }
    }
  }

  console.log('\n=== Done ===')
  if (results.length === 0) console.log('Nothing to sweep.')
  else console.log(`Swept ${results.length} contract(s).`)
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
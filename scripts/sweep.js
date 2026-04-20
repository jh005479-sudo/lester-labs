#!/usr/bin/env node
/**
 * Lester Labs — Fee Sweeper
 * Sweeps native tokens from utility contracts → treasury.
 * Unwraps any wzkLTC held by treasury to native zkLTC.
 *
 * Usage:
 *   node sweep.js --dry-run    (preview only)
 *   node sweep.js             (live — sends txs)
 *
 * Cron: 0 10 * * *  cd ~/Projects/lester-labs && node scripts/sweep.js >> logs/sweep.log 2>&1
 */

const RPC = 'https://liteforge.rpc.caldera.xyz/http'
const PRIVKEY = process.env.SWEEP_PRIVKEY || '8bdaf07bdbd2157bf6c2054e54e78a4a6a0b9f6c70d6087e6952d7d6a5120f43'
const TREASURY = process.env.TREASURY_ADDRESS || '0xDD221FBbCb0f6092AfE51183d964AA89A968eE13'
const WZKLTC = '0xd141A5DDE1a3A373B7e9bb603362A58793AB9D97'
const DRY_RUN = process.argv.includes('--dry-run')

// Utility contracts to sweep (native token fee receiver addresses)
const CONTRACTS = [
  { name: 'ILOFactory',       addr: '0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB' },
  { name: 'TokenFactory',     addr: '0x93acc61fcdc2e3407A0c03450Adfd8aE78964948' },
  { name: 'VestingFactory',   addr: '0x6EE07118D39e9330Ef0658FFA797EeDD2CB823Cf' },
  { name: 'LiquidityLocker',  addr: '0x80d88C7F529D256e5e6A2CB0e0C30D82bC8827A9' },
  { name: 'UniswapV2Factory', addr: '0x017A126A44Aaae9273F7963D4E295F0Ee2793AD8' },
  { name: 'UniswapV2Router',  addr: '0xD56a623890b083d876D47c3b1c5343b7f983FA62' },
]

function fmt(n, dec = 18) {
  return (Number(n) / Math.pow(10, dec)).toFixed(6)
}

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

function hexToBn(hex) {
  if (!hex || hex === '0x') return 0n
  return BigInt(hex)
}

async function getBalance(addr) {
  return hexToBn(await rpc('eth_getBalance', [addr, 'latest']))
}

async function getErc20Balance(token, holder) {
  const data = '0x70a08231000000000000000000000000' + holder.slice(2).toLowerCase()
  return hexToBn(await rpc('eth_call', [{ to: token, data }, 'latest']))
}

async function signSendTx(tx) {
  const signed = await signTransaction(tx, PRIVKEY)
  return rpc('eth_sendSignedTransaction', [signed])
}

// Minimal signer using cast/libsecp256k1 native if available, else eth_sign
async function signTransaction(tx, pk) {
  const chainId = 4441
  const txFields = {
    ...tx,
    nonce: hexToBn(await rpc('eth_getTransactionCount', [tx.from, 'latest'])),
    chainId,
    gasLimit: tx.gas || '0xC350',
    gasPrice: '0x' + (await rpc('eth_gasPrice')) ,
    type: undefined,
  }
  const rlp = encodeRLP(txFields)
  // Use raw signing via EthCrypto or similar — fall back to ethers
  const { ethers } = await import('ethers')
  const wallet = new ethers.Wallet(pk)
  const signed = await wallet.signTransaction({
    ...txFields,
    gasPrice: hexToBn(txFields.gasPrice),
    gasLimit: hexToBn(txFields.gasLimit),
  })
  return signed
}

function encodeRLP(tx) {
  // Simplified — use ethers.js for proper RLP
  return null
}

async function sweepNative(from, to, amount) {
  if (DRY_RUN) {
    console.log(`    [DRY] would send ${fmt(amount)} zkLTC`)
    return '0xdry'
  }
  const { ethers } = await import('ethers')
  const wallet = new ethers.Wallet(PRIVKEY).connect(new ethers.JsonRpcProvider(RPC))
  const tx = await wallet.sendTransaction({
    to,
    value: amount,
    gasLimit: 50000,
  })
  await tx.wait()
  return tx.hash
}

async function unwrapWzkltc(amount) {
  if (DRY_RUN) {
    console.log(`    [DRY] would unwrap ${fmt(amount)} wzkLTC → native`)
    return '0xdry'
  }
  const { ethers } = await import('ethers')
  const wallet = new ethers.Wallet(PRIVKEY).connect(new ethers.JsonRpcProvider(RPC))
  const weth = new ethers.Contract(WZKLTC, [
    'function withdraw(uint256) external',
  ], wallet)
  const tx = await weth.withdraw(amount, { gasLimit: 100000 })
  await tx.wait()
  return tx.hash
}

async function main() {
  console.log(`\n=== Sweep ${new Date().toISOString()} ===`)
  console.log(`Treasury: ${TREASURY}`)
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`)

  // 1. Sweep native from utility contracts
  console.log('[1] Sweeping native zkLTC from utility contracts')
  for (const { name, addr } of CONTRACTS) {
    const bal = await getBalance(addr)
    const fmtd = fmt(bal)
    if (bal === 0n) {
      console.log(`  ${name.padEnd(18)} 0 zkLTC  (skip)`)
      continue
    }
    console.log(`  ${name.padEnd(18)} ${fmtd} zkLTC  → treasury`)
    // Keep 21000 gas buffer; sweep remainder
    const toSend = bal - 21000n
    if (toSend > 0n) {
      const hash = await sweepNative(addr, TREASURY, toSend)
      console.log(`    Swept ${fmt(toSend)} → ${hash.slice(0, 18)}... ✓`)
    }
  }

  // 2. Check treasury wzkLTC balance → auto-unwrap
  console.log('\n[2] Checking treasury wzkLTC balance')
  const wzkltcBal = await getErc20Balance(WZKLTC, TREASURY)
  if (wzkltcBal > 0n) {
    console.log(`  Treasury holds ${fmt(wzkltcBal)} wzkLTC — unwrapping...`)
    const hash = await unwrapWzkltc(wzkltcBal)
    console.log(`  Unwrapped ${fmt(wzkltcBal)} → native ✓`)
  } else {
    console.log('  No wzkLTC to unwrap.')
  }

  // 3. Final treasury balance
  const finalNative = await getBalance(TREASURY)
  console.log(`\n[3] Final treasury native: ${fmt(finalNative)} zkLTC`)
  console.log('\n✓ Sweep complete\n')
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
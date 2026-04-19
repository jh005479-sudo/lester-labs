/**
 * DEX Pool Creation Script for Lester Labs
 * 
 * Sets up 4 pools with correct ratios on LitVM testnet.
 * Each pool uses 1 zkLTC of liquidity with price ratios derived from real-world values.
 * 
 * Run: npx ts-node scripts/create_pools.ts
 */

import { ethers } from 'hardhat'

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || '0x...'
const RPC_URL = 'https://liteforge.rpc.caldera.xyz/http'
const CHAIN_ID = 4441

// DEX Contracts
const ROUTER = '0xD56a623890b083d876D47c3b1c5343b7f983FA62'
const FACTORY = '0x017A126A44Aaae9273F7963D4E295F0Ee2793AD8'
const WZKLTC = '0xd141A5DDE1a3A373B7e9bb603362A58793AB9D97'

// Jack's test tokens (from TokenFactory)
const TOKENS = {
  WETH: '0xdaf8bdc2b197c2f0fab9d7359bdf482f8332b21f',
  WBTC: '0x3bce48a3b30414176e796af997bb1ed5e1dc5b22',
  USDT: '0x4af16cfb61fe9a2c6d1452d85b25e7ca49748f16',
  USDC: '0x7f837d1b20c6ff20d8c6f396760c4f1f1f17babf',
}

// Real-world prices (approximate) for ratio calculation
const PRICES = {
  ZKLTC: 56,      // 1 zkLTC = $56 ( Litecoin mainnet price reference)
  ETH: 2500,      // ETH price in USD
  WBTC: 95000,    // WBTC price in USD (around BTC price ~$95k)
  USDT: 1.00,     // Stable
  USDC: 1.00,     // Stable
}

// Each pool gets 1 zkLTC equivalent in value
const ZKLTC_AMOUNT = ethers.parseEther('1.0')  // 1 zkLTC

interface PoolConfig {
  name: string
  tokenAddress: string
  tokenDecimals: number
  tokenAmount: bigint
  minTokenAmount: bigint
}

function calculateTokenAmount(
  zkLtcAmount: bigint,
  zkLtcPriceUsd: number,
  tokenPriceUsd: number,
  tokenDecimals: number
): bigint {
  // zkLTC amount in USD = zkLTC amount * price
  const usdValue = Number(ethers.formatEther(zkLtcAmount)) * zkLtcPriceUsd
  // Token amount = USD value / token price
  const tokenAmountRaw = usdValue / tokenPriceUsd
  // Convert to token decimals
  return ethers.parseUnits(tokenAmountRaw.toFixed(tokenDecimals), tokenDecimals)
}

async function main() {
  console.log('🏗️  Lester Labs DEX — Pool Creator')
  console.log('===================================\n')

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
  const address = wallet.address

  console.log('Network:', 'LitVM Testnet (Chain', CHAIN_ID, ')')
  console.log('Deployer:', address)
  console.log('')

  // Check balances
  const zkLtcBalance = await provider.getBalance(address)
  console.log('zkLTC balance:', ethers.formatEther(zkLtcBalance))
  
  // Check token balances
  const erc20Abi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)']
  for (const [sym, addr] of Object.entries(TOKENS)) {
    const token = new ethers.Contract(addr, erc20Abi, provider)
    const bal = await token.balanceOf(address)
    const dec = await token.decimals()
    console.log(sym, 'balance:', ethers.formatUnits(bal, Number(dec)))
  }
  console.log('')

  if (zkLtcBalance < ZKLTC_AMOUNT) {
    console.error('❌ Insufficient zkLTC balance. Need at least', ethers.formatEther(ZKLTC_AMOUNT))
    process.exit(1)
  }

  // Calculate amounts for each pool
  // Each pool: 1 zkLTC worth of each token
  const poolConfigs: PoolConfig[] = [
    {
      name: 'wzkLTC/WETH',
      tokenAddress: TOKENS.WETH,
      tokenDecimals: 18,
      tokenAmount: calculateTokenAmount(ZKLTC_AMOUNT, PRICES.ZKLTC, PRICES.ETH, 18),
      minTokenAmount: 0n,
    },
    {
      name: 'wzkLTC/WBTC',
      tokenAddress: TOKENS.WBTC,
      tokenDecimals: 18,
      tokenAmount: calculateTokenAmount(ZKLTC_AMOUNT, PRICES.ZKLTC, PRICES.WBTC, 18),
      minTokenAmount: 0n,
    },
    {
      name: 'wzkLTC/USDT',
      tokenAddress: TOKENS.USDT,
      tokenDecimals: 18,
      tokenAmount: calculateTokenAmount(ZKLTC_AMOUNT, PRICES.ZKLTC, PRICES.USDT, 18),
      minTokenAmount: 0n,
    },
    {
      name: 'wzkLTC/USDC',
      tokenAddress: TOKENS.USDC,
      tokenDecimals: 18,
      tokenAmount: calculateTokenAmount(ZKLTC_AMOUNT, PRICES.ZKLTC, PRICES.USDC, 18),
      minTokenAmount: 0n,
    },
  ]

  console.log('📊 Pool configurations:')
  for (const pool of poolConfigs) {
    console.log(`  ${pool.name}:`)
    console.log(`    zkLTC amount: ${ethers.formatEther(ZKLTC_AMOUNT)}`)
    console.log(`    Token amount: ${ethers.formatUnits(pool.tokenAmount, pool.tokenDecimals)}`)
  }
  console.log('')

  // Router ABI for addLiquidity
  const routerAbi = [
    'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) returns (uint amountA, uint amountB, uint liquidity)',
    'function factory() view returns (address)',
    'function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) view returns (uint amountOut)',
  ]

  const router = new ethers.Contract(ROUTER, routerAbi, wallet)
  const factory = FACTORY

  // Check if pairs already exist
  const factoryAbi = ['function getPair(address, address) view returns (address)']
  const factoryContract = new ethers.Contract(factory, factoryAbi, provider)

  const deadline = Math.floor(Date.now() / 1000) + 3600 // 1 hour

  console.log('🚀 Creating pools...\n')

  for (const pool of poolConfigs) {
    console.log(`Processing ${pool.name}...`)

    // Check if pair exists
    const pairAddress = await factoryContract.getPair(WZKLTC, pool.tokenAddress)
    const pairExists = pairAddress !== '0x0000000000000000000000000000000000000000'

    if (pairExists) {
      console.log(`  ⚠️  Pair already exists at ${pairAddress} — skipping`)
      continue
    }

    // Check token allowance
    const token = new ethers.Contract(pool.tokenAddress, erc20Abi, wallet)
    const allowance = await token.allowance(address, ROUTER)
    const decimals = await token.decimals()

    if (allowance < pool.tokenAmount) {
      console.log(`  Approving ${pool.name} token...`)
      const approveTx = await token.approve(ROUTER, pool.tokenAmount)
      await approveTx.wait()
      console.log(`  ✅ Approved — tx: ${approveTx.hash}`)
    }

    // Build addLiquidity params
    // For establishing initial price ratios: amountADesired = zkLTC amount, amountBDesired = token amount
    // amountAMin and amountBMin can be 0 for initial pool creation (no slippage protection)
    // but we set them to the full amounts to ensure proper ratio

    console.log(`  Adding liquidity:`)
    console.log(`    zkLTC: ${ethers.formatEther(ZKLTC_AMOUNT)}`)
    console.log(`    Token: ${ethers.formatUnits(pool.tokenAmount, Number(decimals))}`)

    try {
      const tx = await router.addLiquidity(
        WZKLTC,
        pool.tokenAddress,
        ZKLTC_AMOUNT,
        pool.tokenAmount,
        ZKLTC_AMOUNT,  // amountAMin = full zkLTC amount (protect ratio)
        pool.tokenAmount, // amountBMin = full token amount (protect ratio)
        address,
        deadline,
        { gasLimit: 500000 }
      )

      console.log(`  ⏳ Waiting for confirmation...`)
      const receipt = await tx.wait()

      // Get the pair address from the event
      const pairCreatedEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = router.interface.parseLog(log)
          return parsed?.name === 'PairCreated'
        } catch { return false }
      })

      console.log(`  ✅ Pool created!`)
      console.log(`    Tx: https://liteforge.explorer.caldera.xyz/tx/${tx.hash}`)
      console.log('')
    } catch (err: any) {
      console.error(`  ❌ Failed: ${err.message.split('\n')[0]}`)
      continue
    }
  }

  console.log('✅ Pool creation complete!')
  console.log('')
  console.log('Verifying pools...')

  // List all pairs
  const routerContract = new ethers.Contract(ROUTER, [
    'function allPairsLength() view returns (uint256)',
    'function allPairs(uint256) view returns (address)',
  ], provider)

  const pairCount = await routerContract.allPairsLength()
  console.log(`Total pairs on router: ${pairCount}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
  })
/**
 * DEX Pool Creation Script for Lester Labs (LiteForge / LitVM testnet)
 * 
 * Sets up 4 pools with correct price ratios.
 * Each pool: ~1 zkLTC + equivalent value of token pair.
 * 
 * Usage: node scripts/create_pools.js
 */

require('dotenv').config();
const { ethers } = require('/Users/jack/Projects/lester-labs/contracts/node_modules/ethers');

const RPC_URL = 'https://liteforge.rpc.caldera.xyz/http';
const CHAIN_ID = 4441;

// ── CONFIG ─────────────────────────────────────────────────────────────────

const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x...your-private-key...';

// DEX Contracts
const ROUTER = '0xD56a623890b083d876D47c3b1c5343b7f983FA62';
const FACTORY = '0x017A126A44Aaae9273F7963D4E295F0Ee2793AD8';
const WZKLTC = '0xd141A5DDE1a3A373B7e9bb603362A58793AB9D97';

// Jack's test tokens (LL prefix = Lester Labs minted via TokenFactory)
const TOKENS = {
  WETH:  '0xdaf8bdc2b197c2f0fab9d7359bdf482f8332b21f',
  WBTC:  '0x3bce48a3b30414176e796af997bb1ed5e1dc5b22',
  USDT:  '0x4af16cfb61fe9a2c6d1452d85b25e7ca49748f16',
  USDC:  '0x7f837d1b20c6ff20d8c6f396760c4f1f1f17babf',
};

// Real-world price approximations (USD) for ratio calculation
const PRICES = {
  ZKLTC: 56,
  ETH:   2500,
  WBTC:  95000,
  USDT:  1.00,
  USDC:  1.00,
};

// Each pool gets 1 zkLTC equivalent worth of the token
const ZKLTC_AMOUNT = ethers.parseEther('0.8'); // Leave some for gas

// ─────────────────────────────────────────────────────────────────────────

async function calculateTokenAmount(zkLtcAmount, zkLtcPrice, tokenPrice, decimals) {
  const usdValue = Number(ethers.formatEther(zkLtcAmount)) * zkLtcPrice;
  const tokenAmountRaw = usdValue / tokenPrice;
  return ethers.parseUnits(tokenAmountRaw.toFixed(decimals), decimals);
}

async function main() {
  console.log('🏗️  Lester Labs DEX — Pool Creator');
  console.log('===================================\n');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const address = wallet.address;

  console.log('Network:', 'LitVM Testnet (Chain', CHAIN_ID, ')');
  console.log('Deployer:', address);
  console.log('');

  const zkLtcBalance = await provider.getBalance(address);
  console.log('zkLTC balance:', ethers.formatEther(zkLtcBalance));

  const erc20Abi = [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
  ];

  for (const [sym, addr] of Object.entries(TOKENS)) {
    const token = new ethers.Contract(addr, erc20Abi, provider);
    try {
      const bal = await token.balanceOf(address);
      const dec = await token.decimals();
      console.log(sym, 'balance:', ethers.formatUnits(bal, Number(dec)));
    } catch(e) {
      console.log(sym, 'error:', e.message.split('\n')[0]);
    }
  }
  console.log('');

  if (zkLtcBalance < ZKLTC_AMOUNT) {
    console.error('❌ Insufficient zkLTC. Need', ethers.formatEther(ZKLTC_AMOUNT), 'have', ethers.formatEther(zkLtcBalance));
    process.exit(1);
  }

  // Calculate amounts for each pool
  const poolConfigs = [
    {
      name: 'wzkLTC/WETH',
      tokenAddress: TOKENS.WETH,
      tokenDecimals: 18,
      tokenAmount: await calculateTokenAmount(ZKLTC_AMOUNT, PRICES.ZKLTC, PRICES.ETH, 18),
    },
    {
      name: 'wzkLTC/WBTC',
      tokenAddress: TOKENS.WBTC,
      tokenDecimals: 18,
      tokenAmount: await calculateTokenAmount(ZKLTC_AMOUNT, PRICES.ZKLTC, PRICES.WBTC, 18),
    },
    {
      name: 'wzkLTC/USDT',
      tokenAddress: TOKENS.USDT,
      tokenDecimals: 18,
      tokenAmount: await calculateTokenAmount(ZKLTC_AMOUNT, PRICES.ZKLTC, PRICES.USDT, 18),
    },
    {
      name: 'wzkLTC/USDC',
      tokenAddress: TOKENS.USDC,
      tokenDecimals: 18,
      tokenAmount: await calculateTokenAmount(ZKLTC_AMOUNT, PRICES.ZKLTC, PRICES.USDC, 18),
    },
  ];

  console.log('📊 Pool configurations (per pool):');
  for (const pool of poolConfigs) {
    console.log(`  ${pool.name}:`);
    console.log(`    zkLTC amount:  ${ethers.formatEther(ZKLTC_AMOUNT)}`);
    console.log(`    Token amount: ${ethers.formatUnits(pool.tokenAmount, pool.tokenDecimals)}`);
  }
  console.log('');

  // ── STEP 1: Approve WZKLTC (router pulls WZKLTC via transferFrom) ─────────────
  console.log('📝 Pre-approvals...');
  const wzkContract = new ethers.Contract(WZKLTC, erc20Abi, wallet);
  const wzkAllowance = await wzkContract.allowance(address, ROUTER);
  console.log('  WZKLTC current allowance:', ethers.formatEther(wzkAllowance));

  if (wzkAllowance < ZKLTC_AMOUNT * 2n) {
    console.log('  Approving WZKLTC for router...');
    const wzkApproveTx = await wzkContract.approve(ROUTER, ethers.parseEther('1000'));
    await wzkApproveTx.wait();
    console.log('  ✅ WZKLTC approved — tx: https://liteforge.explorer.caldera.xyz/tx/' + wzkApproveTx.hash);
  } else {
    console.log('  ✅ WZKLTC already approved');
  }
  console.log('');

  // Router interface
  const routerAbi = [
    'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) returns (uint amountA, uint amountB, uint liquidity)',
  ];

  const router = new ethers.Contract(ROUTER, routerAbi, wallet);

  // Factory interface for checking existing pairs
  const factoryAbi = ['function getPair(address, address) view returns (address)'];
  const factoryContract = new ethers.Contract(FACTORY, factoryAbi, provider);

  const deadline = Math.floor(Date.now() / 1000) + 3600;

  console.log('🚀 Creating pools...\n');

  const results = [];

  for (const pool of poolConfigs) {
    console.log(`Processing ${pool.name}...`);

    try {
      // Check if pair already exists
      const pairAddress = await factoryContract.getPair(WZKLTC, pool.tokenAddress);
      const pairExists = pairAddress !== '0x0000000000000000000000000000000000000000';

      if (pairExists) {
        console.log(`  ⏭️  Pair already exists at ${pairAddress} — skipping\n`);
        results.push({ name: pool.name, status: 'skipped', pair: pairAddress });
        continue;
      }

      // Approve the token (router pulls it via transferFrom)
      const token = new ethers.Contract(pool.tokenAddress, erc20Abi, wallet);
      const decimals = await token.decimals();
      const allowance = await token.allowance(address, ROUTER);

      if (allowance < pool.tokenAmount) {
        console.log(`  Approving ${pool.name}...`);
        const approveTx = await token.approve(ROUTER, pool.tokenAmount);
        const approveReceipt = await approveTx.wait();
        console.log(`  ✅ Approved — tx: https://liteforge.explorer.caldera.xyz/tx/${approveReceipt.hash}`);
      } else {
        console.log(`  ✅ Token already approved`);
      }

      const tokenBalance = await token.balanceOf(address);
      if (tokenBalance < pool.tokenAmount) {
        console.error(`  ❌ Insufficient ${pool.name} balance. Need ${ethers.formatUnits(pool.tokenAmount, decimals)}, have ${ethers.formatUnits(tokenBalance, decimals)}`);
        results.push({ name: pool.name, status: 'insufficient_balance' });
        continue;
      }

      console.log(`  Adding liquidity (zkLTC: ${ethers.formatEther(ZKLTC_AMOUNT)}, Token: ${ethers.formatUnits(pool.tokenAmount, decimals)})...`);

      const tx = await router.addLiquidity(
        WZKLTC,
        pool.tokenAddress,
        ZKLTC_AMOUNT,
        pool.tokenAmount,
        0,  // amountAMin = 0 (initial pool, no protection needed)
        0,  // amountBMin = 0 (initial pool, no protection needed)
        address,
        deadline,
        { gasLimit: 800000 }
      );

      console.log(`  ⏳ Waiting for confirmation...`);
      const receipt = await tx.wait();

      // Get the pair from the PairCreated event
      let createdPair = null;
      for (const log of receipt.logs) {
        try {
          const factoryIface = new ethers.Interface([
            'event PairCreated(address indexed token0, address indexed token1, address pair, uint256)',
          ]);
          const parsed = factoryIface.parseLog(log);
          if (parsed && parsed.name === 'PairCreated') {
            createdPair = parsed.args.pair;
          }
        } catch(e) {}
      }

      console.log(`  ✅ Pool created!`);
      console.log(`    Tx: https://liteforge.explorer.caldera.xyz/tx/${tx.hash}`);
      if (createdPair) console.log(`    Pair: ${createdPair}`);
      console.log('');
      results.push({ name: pool.name, status: 'created', tx: tx.hash, pair: createdPair });

    } catch(err) {
      console.error(`  ❌ Failed: ${err.message.split('\n')[0]}`);
      console.log('');
      results.push({ name: pool.name, status: 'failed', error: err.message.split('\n')[0] });
    }
  }

  console.log('═══════════════════════════════════');
  console.log('📋 Summary:');
  for (const r of results) {
    console.log(`  ${r.status === 'created' ? '✅' : r.status === 'skipped' ? '⏭️ ' : '❌'} ${r.name} — ${r.status}${r.pair ? ' @ ' + r.pair : ''}`);
  }
  console.log('');
  console.log('Done!');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
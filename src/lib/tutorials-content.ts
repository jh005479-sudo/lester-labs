// Tutorial articles content — one entry per article
// Images: CSS gradient IDs from the article hero component

// Section types — all fields optional, renderer narrows by type field
export interface TutorialSection {
  type: 'text' | 'step' | 'callout' | 'code' | 'image'
  heading?: string
  body?: string
  steps?: { title: string; body: string }[]
  callout?: { type: 'info' | 'warning' | 'tip'; text: string }
  code?: { lang: string; content: string }
  src?: string
  alt?: string
  caption?: string
  // Allow extra fields per variant without TS errors
  [key: string]: unknown
}

export interface TutorialArticle {
  slug: string
  title: string
  subtitle: string
  badge: string
  badgeColor: string
  readTime: string
  category: string
  heroGradient: string    // CSS gradient class
  heroAccent: string       // hex color
  sections: TutorialSection[]
  related?: string[]       // slugs of related articles
}

export const TUTORIALS: TutorialArticle[] = [
  {
    slug: 'what-is-litvm',
    title: 'What is LitVM?',
    subtitle: 'ZK proofs meet Litecoin — a validity-proof Layer 2 that brings smart contracts and DeFi to the LTC ecosystem without compromising decentralization.',
    badge: 'Ecosystem',
    badgeColor: '#818cf8',
    readTime: '6 min read',
    category: 'Getting Started',
    heroGradient: 'linear-gradient(135deg, #0f0c29 0%, #1a1a3e 50%, #242043 100%)',
    heroAccent: '#818cf8',
    sections: [
      {
        type: 'text',
        heading: 'The problem with bringing smart contracts to Litecoin',
        body: 'Bitcoin and Litecoin were designed as payment networks first. Adding programmability to BTC or LTC is hard because the base chains are UTXO-based, not account-based — and they prioritise security and simplicity over expressiveness.\n\nThe naive solution is a sidechain. But most sidechains rely on federation multisigs or trusted validators, which introduces a single point of failure. If the validator set is compromised or dishonest, funds can be stolen.\n\nLitVM takes a different approach: validity proofs.',
      },
      {
        type: 'callout',
        callout: {
          type: 'info',
          text: 'LitVM is currently on testnet. The addresses, contracts, and tokens described here are on the LitVM test network (chain ID 4441), not the Litecoin mainnet.',
        },
      },
      {
        type: 'text',
        heading: 'Validity proofs — trustless compression',
        body: 'A validity proof is a cryptographic certificate produced by a prover (the sequencer) that proves every state transition on LitVM was computed correctly. Unlike fraud proofs (Optimism/Avalanche), validity proofs make invalid states mathematically impossible — not just economically disincentivised.\n\nThe proof is tiny: a few hundred bytes. Anyone can verify it against the Litecoin root, without re-executing all the transactions. This means:\n\n• Litecoin nodes don’t need to process every LitVM transaction\n• Security inherits directly from Litecoin — no separate validator set\n• Finality is as fast as the next Litecoin block',
      },
      {
        type: 'image',
        src: '/images/tutorials/litvm-diagram.svg',
        alt: 'LitVM architecture diagram showing validity proof generation',
        caption: 'LitVM batches transactions, generates a ZK proof, and posts the proof + state diff to Litecoin. Verification is O(1) — independent of transaction count.',
      },
      {
        type: 'text',
        heading: 'EVM compatibility',
        body: 'LitVM is EVM-equivalent — Solidity contracts, Hardhat, Foundry, and all standard Ethereum tooling work out of the box. This is a deliberate design choice: the hardest part of building a Layer 2 isn’t consensus, it’s getting developers to port their code.\n\nBy speaking EVM natively, LitVM can absorb the existing Ethereum developer ecosystem without requiring any code changes. Your Hardhat config works. Your OpenZeppelin contracts work. Your existing Web3.js or viem frontends work.',
      },
      {
        type: 'step',
        heading: 'How a transaction flows on LitVM',
        steps: [
          {
            title: 'User sends a transaction',
            body: 'A user interacts with a dApp — say, swapping tokens on a LitVM DEX. Their transaction goes to a sequencer, which orders it and executes it against the current state.',
          },
          {
            title: 'The sequencer generates a proof',
            body: 'After batching a set of transactions, the sequencer runs the execution trace through a ZK prover (Groth16) to generate a validity proof. This proof certifies that all state transitions in the batch were computed correctly.',
          },
          {
            title: 'The proof is posted to Litecoin',
            body: 'The proof (a few hundred bytes) plus a minimal state diff are posted as a single Litecoin transaction. Litecoin validators or full nodes verify the proof without re-running the transactions.',
          },
          {
            title: 'State is finalized',
            body: 'Once the proof is accepted on Litecoin, the corresponding LitVM state is considered final. There is no challenge period, no fraud window — just cryptographic truth.',
          },
        ],
      },
      {
        type: 'callout',
        callout: {
          type: 'tip',
          text: 'Because LitVM state is secured by cryptographic proofs rather than economic games, it’s safe to use with much shorter confirmation times than optimistic rollups. Always confirm against your own risk tolerance.',
        },
      },
      {
        type: 'text',
        heading: 'What you can build on LitVM — DeFi, tokens, and beyond',
        body: 'LitVM supports the full EVM instruction set, which means:\n\n• **DeFi protocols** — DEXs, lending markets, yield aggregators\n• **Token standards** — ERC-20, ERC-721 (NFTs), ERC-4626 (vaults)\n• **Cross-chain bridges** — trustless bridges using Litecoin as the settlement layer\n• **Gaming** — on-chain game state, asset ownership\n• **Identity** — ENS-style naming, credential systems\n\nThe gas fees are paid in zkLTC, and because the proof compresses the data published to Litecoin, costs stay low even when the chain is busy.',
      },
    ],
    related: ['setting-up-litvm-wallet', 'understanding-zklktc'],
  },

  {
    slug: 'setting-up-litvm-wallet',
    title: 'Setting up your LitVM wallet in 5 minutes',
    subtitle: 'MetaMask, Rabby, or any EVM-compatible wallet can connect to LitVM testnet. Here’s the exact configuration to get it right first time.',
    badge: 'Setup',
    badgeColor: '#4ade80',
    readTime: '5 min read',
    category: 'Getting Started',
    heroGradient: 'linear-gradient(135deg, #0d1f1a 0%, #1a3330 50%, #0f2922 100%)',
    heroAccent: '#4ade80',
    sections: [
      {
        type: 'text',
        heading: 'What you’ll need',
        body: 'Before starting, make sure you have:\n\n• MetaMask (recommended), Rabby, or another EVM-compatible wallet\n• A small amount of LTC in your wallet (for bridging to zkLTC later)\n• Access to the LitVM testnet RPC endpoint\n\nNo custom wallet software is needed. LitVM’s EVM compatibility means your existing wallet does everything required.',
      },
      {
        type: 'step',
        heading: 'Adding LitVM testnet to MetaMask',
        steps: [
          {
            title: 'Open wallet settings',
            body: 'Click the network selector at the top of MetaMask, then click "Add network". Scroll to the bottom and click "Add a network manually".',
          },
          {
            title: 'Enter the LitVM testnet details',
            body: 'Fill in the fields exactly as shown:\n\n• Network name: LitVM Testnet\n• New RPC URL: https://liteforge.rpc.caldera.xyz/infra-partner-http\n• Chain ID: 4441\n• Currency symbol: zkLTC\n• Block explorer URL: https://liteforge.caldera.xyz\n\nThe RPC URL is provided by Caldera as a LitVM infrastructure partner. Using this endpoint gives you faster and more consistent responses than the public RPC.',
          },
          {
            title: 'Click Save',
            body: 'MetaMask will connect to LitVM testnet. You’ll see "LitVM Testnet" appear in your network selector. You’re now connected.',
          },
        ],
      },
      {
        type: 'code',
        lang: 'json',
        content: `// LitVM Testnet configuration
{
  "chainId": "0x1159",          // 4441 in hex
  "chainName": "LitVM Testnet",
  "nativeCurrency": {
    "name": "zkLTC",
    "symbol": "zkLTC",
    "decimals": 18
  },
  "rpcUrls": ["https://liteforge.rpc.caldera.xyz/infra-partner-http"],
  "blockExplorerUrls": ["https://liteforge.caldera.xyz"]
}`,
      },
      {
        type: 'callout',
        callout: {
          type: 'warning',
          text: 'Make sure you’re on chain ID 4441 when transacting. If MetaMask connects to a different chain with the same Chain ID (extremely unlikely), you could send funds to the wrong place. Always verify the chain ID in network settings.',
        },
      },
      {
        type: 'text',
        heading: 'Getting testnet zkLTC',
        body: 'The LitVM testnet faucet distributes free zkLTC for testing. Visit the faucet (link in the Lester Labs nav), connect your wallet, and claim your test tokens. There’s a per-wallet limit to prevent hoarding, but it’s sufficient for development and testing.\n\nFor larger testnet amounts needed during active development, contact the LitVM team through their Discord or Telegram channels.',
      },
    ],
    related: ['what-is-litvm', 'understanding-zklktc'],
  },

  {
    slug: 'understanding-zklktc',
    title: 'Understanding zkLTC — the fuel of LitVM',
    subtitle: 'zkLTC is the native gas token of LitVM. Understanding how it’s minted, bridged, and why it’s more efficient than naively wrapping LTC.',
    badge: 'Tokens',
    badgeColor: '#fbbf24',
    readTime: '7 min read',
    category: 'Getting Started',
    heroGradient: 'linear-gradient(135deg, #1a1500 0%, #2e2600 50%, #1f1a00 100%)',
    heroAccent: '#fbbf24',
    sections: [
      {
        type: 'text',
        heading: 'Why not just use LTC?',
        body: 'The short answer is efficiency. Litecoin’s scripting language is limited, and the fee market for LTC transactions is competitive. Every LTC transfer costs real money and takes meaningful block space. Routing all LitVM gas fees through native LTC would mean thousands of LTC-level transactions per day just for gas.\n\nzkLTC solves this by existing as a first-class citizen on LitVM itself — a standard ERC-20 token that happens to represent LTC utility. Fees on LitVM are paid in zkLTC, and the economics are decoupled from LTC base chain congestion.',
      },
      {
        type: 'callout',
        callout: {
          type: 'info',
          text: 'zkLTC on LitVM testnet is test tokens only and has no monetary value. The bridge to mint real zkLTC on mainnet will go live alongside the mainnet launch.',
        },
      },
      {
        type: 'text',
        heading: 'The bridge mechanic',
        body: 'To move value from Litecoin mainnet to LitVM, users send LTC to a bridge contract on the Litecoin chain. The bridge monitors this deposit, validates it through Litecoin’s proof-of-work, and mints the equivalent zkLTC on LitVM.\n\nThe reverse works the same way: burn zkLTC on LitVM → the bridge releases LTC on mainnet. This is a trustless, non-custodial bridge because:\n\n• The bridge contract on Litecoin is a simple timelocked vault\n• LitVM posts validity proofs to Litecoin that include the canonical state of the bridge\n• If the bridge tries to cheat (release LTC without a valid burn), the validity proof would be invalid',
      },
      {
        type: 'step',
        heading: 'How to get zkLTC (testnet)',
        steps: [
          {
            title: 'Visit the faucet',
            body: 'Go to the LitVM faucet page from the navigation. Connect your MetaMask or Rabby wallet.',
          },
          {
            title: 'Switch to LitVM testnet',
            body: 'If you haven’t added LitVM testnet yet, the faucet will prompt you to add it automatically. Approve the network addition in your wallet.',
          },
          {
            title: 'Claim your test zkLTC',
            body: 'Click "Claim" and confirm the transaction in your wallet. You’ll receive a set amount of test zkLTC instantly. There’s a cooldown between claims to prevent abuse.',
          },
          {
            title: 'Bridge real LTC for mainnet',
            body: 'On mainnet, the bridge UI allows you to send LTC from your wallet to the bridge contract. After the proof is validated (typically a few Litecoin blocks), zkLTC appears in your LitVM wallet.',
          },
        ],
      },
      {
        type: 'callout',
        callout: {
          type: 'tip',
          text: 'Gas fees on LitVM are significantly lower than Ethereum L2s because the validity proofs mean Litecoin nodes don’t need to process every transaction. A typical ERC-20 transfer on LitVM costs fractions of a cent at LTC’s current price.',
        },
      },
    ],
    related: ['setting-up-litvm-wallet', 'what-is-litvm'],
  },

  {
    slug: 'launchpad-how-it-works',
    title: 'LitVM Launchpad — How to Run a Permissionless Token Presale',
    subtitle: 'A complete walkthrough of the LitVM Launchpad: configuring caps and timelines, the automatic LP creation mechanic, and how to give your community a fair shot at your token launch on LitVM.',
    badge: 'Launchpad',
    badgeColor: '#a78bfa',
    readTime: '8 min read',
    category: 'dApp Guides',
    heroGradient: 'linear-gradient(135deg, #1a0f2e 0%, #2a1a4a 50%, #1a0f2e 100%)',
    heroAccent: '#a78bfa',
    sections: [
      {
        type: 'text',
        heading: 'What makes the Launchpad different',
        body: 'Most presale platforms require you to apply, get approved, and pay listing fees to a central team. The Lester Labs Launchpad is fully permissionless: if you have a token and a community, you can launch.\n\nThe ILO (Initial Liquidity Offering) factory deploys a new presale contract for every launch. The contract enforces the rules — caps, timelines, contribution limits — in Solidity, not in a backend server that can be shut down or modified mid-sale.',
      },
      {
        type: 'step',
        heading: 'Step-by-step: creating a presale',
        steps: [
          {
            title: 'Have a deployed ERC-20 token',
            body: 'You’ll need your token’s contract address ready. Use the Token Factory to deploy one if you don’t have one yet — it takes under a minute and costs 0.05 zkLTC.',
          },
          {
            title: 'Navigate to the Launchpad',
            body: 'Go to lester-labs.com/launchpad and click the "Create" tab. Connect your wallet and switch to LitVM network.',
          },
          {
            title: 'Enter your token address',
            body: 'Paste your token contract address. The UI will fetch the token’s decimals automatically and display the token name and symbol for confirmation.',
          },
          {
            title: 'Set your caps',
            body: 'Soft cap: the minimum amount required for the presale to proceed. If this isn’t reached by the end time, contributors can withdraw. Hard cap: the maximum the presale can raise. Once reached, the sale ends immediately.',
          },
          {
            title: 'Set the price',
            body: 'Enter the number of tokens a contributor receives per 1 zkLTC. For example, if you want 1 zkLTC = 1,000,000 tokens, enter 1000000. The math handles the decimals automatically.',
          },
          {
            title: 'Choose your timeline',
            body: 'Select start and end dates. The presale goes live at the start time and closes automatically at the end time (or earlier if the hard cap is hit).',
          },
          {
            title: 'Configure LP settings',
            body: 'Set what percentage of raised zkLTC goes to the liquidity pool. Higher % = more LP depth = better trading experience. Also set the LP lock duration — how long your LP tokens are locked before you can withdraw.',
          },
          {
            title: 'Deploy and deposit',
            body: 'Pay the creation fee (shown live from the contract), confirm in your wallet. After deployment, transfer your full token allocation to the presale contract address — the exact amount is shown as "tokens required" in the confirmation screen.',
          },
        ],
      },
      {
        type: 'callout',
        callout: {
          type: 'warning',
          text: 'Do not forget to deposit your tokens to the presale contract. If the presale ends without the tokens deposited, the raise is invalid and contributors can withdraw their zkLTC. Double-check the contract address matches the one displayed in the confirmation.',
        },
      },
      {
        type: 'text',
        heading: 'How LP creation works',
        body: 'When a presale finalizes (either after the end date or when the hard cap is hit), the ILO hands the launch liquidity to Lester Labs\' `UniSwapConnector`, which verifies the local Uniswap V2 factory still points both `feeTo` and `feeToSetter` at the Lester treasury before seeding the pair through the Lester Labs router. The resulting LP tokens stay locked as part of the launch flow — no external DEX or admin handoff is required.\n\nThe platform still takes a 2% fee on the total raise at finalization. Once the pair is live, trades on that pair pay 0.30% total: 0.20% to the Lester Labs treasury and 0.10% retained by LPs.',
      },
    ],
    related: ['token-factory-guide', 'liquidity-locker-guide'],
  },

  {
    slug: 'how-to-use-dex-swap',
    title: 'How to Use the LitVM DEX Swap',
    subtitle: 'Connect to LitVM, approve tokens, execute a swap on the native LitVM decentralized exchange, add liquidity, and track LP positions from the pool page. Full walkthrough of the Lester Labs DEX on LitVM.',
    badge: 'DEX',
    badgeColor: '#E44FB5',
    readTime: '6 min read',
    category: 'dApp Guides',
    heroGradient: 'linear-gradient(135deg, #140811 0%, #26111f 50%, #140811 100%)',
    heroAccent: '#E44FB5',
    sections: [
      {
        type: 'text',
        heading: 'What you need before swapping',
        body: 'The Lester Labs DEX runs on LitVM testnet and uses zkLTC as the native gas asset. Before you trade, make sure your wallet is connected to LitVM, you hold a little zkLTC for gas, and the token you want to swap is already deployed on LitVM.\n\nThe swap page uses Lester Labs\' own Uniswap V2 router and factory. Quotes come directly from the on-chain router, and the fee split is fixed at the pair level: 0.20% to the Lester Labs treasury and 0.10% retained by liquidity providers.',
      },
      {
        type: 'step',
        heading: 'Five-step swap flow',
        steps: [
          {
            title: 'Connect your wallet to LitVM',
            body: 'Open lester-labs.com/swap and connect your wallet. If LitVM is not already configured, add it with Chain ID 4441, RPC https://liteforge.rpc.caldera.xyz/infra-partner-http, native currency zkLTC, and explorer https://liteforge.caldera.xyz.',
          },
          {
            title: 'Approve tokens for trading',
            body: 'If your input asset is an ERC-20 token rather than native zkLTC, the swap page will prompt you to approve the Lester Labs router first. This is a standard one-time allowance transaction that lets the router move only that token on your behalf.',
          },
          {
            title: 'Make the swap',
            body: 'Choose your input token, output token, and amount. The interface fetches a live quote via `getAmountsOut`, shows your expected output, and applies the displayed slippage tolerance before building the transaction. Review the fee line carefully: every trade pays 0.30% total.',
          },
          {
            title: 'Add liquidity to a pool',
            body: 'At launch, liquidity is typically seeded either through Lester Labs Launchpad finalization or through direct router interactions by integrators. In both cases the liquidity lands on the same Lester Labs Uniswap V2 deployment, and the resulting LP balance becomes visible on `/pool` once the position is live.',
          },
          {
            title: 'View your positions',
            body: 'Visit lester-labs.com/pool to scan your connected wallet for LP balances. The pool page shows your LP token balance, your percentage share of each pool, and the underlying token exposure represented by that position.',
          },
        ],
      },
      {
        type: 'callout',
        callout: {
          type: 'tip',
          text: 'The router handles native zkLTC through a wrapped zkLTC contract under the hood. In the UI you continue to think in native zkLTC, but under the hood the DEX can still support standard Uniswap V2 pair mechanics.',
        },
      },
      {
        type: 'code',
        lang: 'json',
        content: `// LitVM Testnet configuration
{
  "chainId": "0x1159",
  "chainName": "LitVM Testnet",
  "nativeCurrency": {
    "name": "zkLTC",
    "symbol": "zkLTC",
    "decimals": 18
  },
  "rpcUrls": ["https://liteforge.rpc.caldera.xyz/infra-partner-http"],
  "blockExplorerUrls": ["https://liteforge.caldera.xyz"]
}`,
      },
      {
        type: 'text',
        heading: 'Fee breakdown and treasury routing',
        body: 'The Lester Labs V2 fork is configured so every live pair routes protocol fees to the Lester Labs treasury. The factory sets both `feeTo` and `feeToSetter` to that treasury, and the pair contract transfers 0.20% of each swap input directly to the treasury while leaving 0.10% inside the pool for LP earnings.',
      },
    ],
    related: ['setting-up-litvm-wallet', 'launchpad-how-it-works', 'liquidity-locker-guide'],
  },

  {
    slug: 'token-factory-guide',
    title: 'Token Factory — launch an ERC-20 in 60 seconds',
    subtitle: 'How to deploy a fully standard ERC-20 token on LitVM using the Token Factory. No Solidity knowledge required — just a few clicks and you’re live.',
    badge: 'Token Factory',
    badgeColor: '#6366f1',
    readTime: '4 min read',
    category: 'dApp Guides',
    heroGradient: 'linear-gradient(135deg, #0f0c29 0%, #1e1a4a 50%, #0f0c29 100%)',
    heroAccent: '#6366f1',
    sections: [
      {
        type: 'text',
        heading: 'Why use the Token Factory?',
        body: 'You could write your own Solidity ERC-20 contract, audit it, and deploy it manually. Or you could use the Token Factory: a factory contract that deploys a standard OpenZeppelin ERC-20 implementation in a single transaction.\n\nThe contracts are battle-tested OpenZeppelin code — the same library used by most DeFi protocols in production. The factory emits a TokenCreated event so explorers and dashboards can surface your token automatically.',
      },
      {
        type: 'step',
        heading: 'Deploying your token',
        steps: [
          {
            title: 'Go to Token Factory',
            body: 'Navigate to lester-labs.com/launch. Connect your wallet and ensure you’re on LitVM testnet.',
          },
          {
            title: 'Fill in the details',
            body: 'Token name: e.g. "My Project Token"\nToken symbol: e.g. "MPT" (max 8 characters)\nInitial supply: total number of tokens to mint at deployment\nDecimals: 18 (the standard — only change if you have a specific reason)',
          },
          {
            title: 'Choose options',
            body: 'Mintable: allow the deployer to create more tokens after deployment (recommended for most projects)\nBurnable: allow any holder to burn their own tokens (useful for deflationary mechanics)',
          },
          {
            title: 'Confirm and deploy',
            body: 'Review the fee (0.05 zkLTC) and click Deploy. Sign the transaction in your wallet. Your token contract is deployed instantly — the contract address appears in the confirmation and is automatically indexed.',
          },
        ],
      },
      {
        type: 'callout',
        callout: {
          type: 'tip',
          text: 'Once deployed, your token is permanent on LitVM. Make sure you’ve verified the contract address is correct before sharing it. You can always find it again by searching your wallet address on the block explorer.',
        },
      },
    ],
    related: ['launchpad-how-it-works', 'liquidity-locker-guide'],
  },

  {
    slug: 'liquidity-locker-guide',
    title: 'Liquidity Locker — protecting your LP tokens',
    subtitle: 'How LP token locking works, why it matters for credibility, and how to lock your liquidity so your community knows you can’t rug the pool.',
    badge: 'Locker',
    badgeColor: '#f59e0b',
    readTime: '5 min read',
    category: 'dApp Guides',
    heroGradient: 'linear-gradient(135deg, #1a1200 0%, #2e2000 50%, #1a1200 100%)',
    heroAccent: '#f59e0b',
    sections: [
      {
        type: 'text',
        heading: 'What is an LP token lock and why does it matter?',
        body: 'When you create a liquidity pool on a DEX, you receive LP tokens representing your share of the pool. These tokens are usually transferable — which means you can withdraw your liquidity at any time, even if it devastates the token’s price.\n\nA liquidity lock renders those LP tokens non-transferable until the unlock date. The contract enforces this at the protocol level — no admin key can override it. Investors and communities can verify the lock on-chain before participating in a presale or token sale.',
      },
      {
        type: 'callout',
        callout: {
          type: 'info',
          text: 'Not all locks are equal. A timelock that can be emergency-withdrawn by an admin is not a true lock. The Lester Labs Liquidity Locker is immutable after deployment — once locked, the LP cannot be moved until the timestamp is reached.',
        },
      },
      {
        type: 'step',
        heading: 'Locking your LP tokens',
        steps: [
          {
            title: 'Go to Liquidity Locker',
            body: 'Navigate to lester-labs.com/locker. Connect your wallet holding the LP tokens you want to lock.',
          },
          {
            title: 'Select the LP token',
            body: 'The UI shows all LP tokens held by your connected wallet. Select the one you want to lock.',
          },
          {
            title: 'Set the unlock date',
            body: 'Choose when the LP becomes transferable. Common choices: 6 months, 1 year, or 2 years. The further in the future, the more credibility it signals to your community.',
          },
          {
            title: 'Lock and verify',
            body: 'Confirm the transaction. Once confirmed, the lock is permanent and immutably recorded on LitVM. Share the lock proof URL with your community.',
          },
        ],
      },
    ],
    related: ['launchpad-how-it-works', 'token-factory-guide'],
  },

  {
    slug: 'the-ledger-guide',
    title: 'The Ledger — posting messages on-chain forever',
    subtitle: 'How The Ledger works, why calldata is a legitimate storage layer, and how to post your first permanent message to the LitVM blockchain.',
    badge: 'The Ledger',
    badgeColor: '#22d3ee',
    readTime: '5 min read',
    category: 'dApp Guides',
    heroGradient: 'linear-gradient(135deg, #001a1a 0%, #003333 50%, #001a1a 100%)',
    heroAccent: '#22d3ee',
    sections: [
      {
        type: 'text',
        heading: 'Storing data in transaction calldata',
        body: 'Every Ethereum Virtual Machine transaction includes a data field called "calldata." This is where function arguments, ABI-encoded parameters, and arbitrary bytes live. It’s recorded permanently in the chain history — every full node, every archive node, every RPC provider stores it.\n\nThe Ledger puts human-readable UTF-8 text directly in this calldata field. When you call post("GM"), the bytes [0x47, 0x4d] are embedded in the transaction input data, which is permanently etched into the blockchain. There’s no server, no database, no admin — just a contract that reads your calldata and emits an event.',
      },
      {
        type: 'callout',
        callout: {
          type: 'warning',
          text: 'Messages are immutable and permanent once confirmed. There is no edit, no delete, no "undo." The on-chain record cannot be altered by anyone — including the Lester Labs team.',
        },
      },
      {
        type: 'step',
        heading: 'Posting your first message',
        steps: [
          {
            title: 'Go to The Ledger',
            body: 'Navigate to lester-labs.com/ledger. Connect your wallet. No token purchase needed — you pay in native zkLTC.',
          },
          {
            title: 'Write your message',
            body: 'Type up to 1,024 characters. The character counter shows how much space you have. Messages can be plain text, unicode characters, or emojis.',
          },
          {
            title: 'Post and confirm',
            body: 'Click "Post to Ledger." The fee is shown before you confirm (0.01 LTC). Once the transaction confirms, your message is permanently stored on LitVM.',
          },
          {
            title: 'Share your proof',
            body: 'Click the transaction hash in the confirmation to view your message on the block explorer. Share the link as proof of your message and timestamp.',
          },
        ],
      },
      {
        type: 'text',
        heading: 'Reading The Ledger without a wallet',
        body: 'You don’t need to connect a wallet to read The Ledger. Just visit lester-labs.com/ledger — the feed loads publicly via LitVM RPC. Every message shows the wallet that posted it, the block number, and a link to the raw transaction.\n\nThis is what makes it genuinely different from a database-backed social layer: the data is available to anyone, forever, without relying on lester-labs.com being online.',
      },
    ],
    related: ['what-is-litvm'],
  },

  {
    slug: 'airdrop-tool-guide',
    title: 'LitVM Airdrop Tool — Batch Token Distribution on LitVM',
    subtitle: 'How to use the LitVM Airdrop Tool to send tokens to thousands of wallets in a single transaction. CSV upload, merkle proof mode, and on-chain verification for LitVM token distributions.',
    badge: 'Airdrop',
    badgeColor: '#f97316',
    readTime: '6 min read',
    category: 'dApp Guides',
    heroGradient: 'linear-gradient(135deg, #1a0f00 0%, #2e1a00 50%, #1a0f00 100%)',
    heroAccent: '#f97316',
    sections: [
      {
        type: 'text',
        heading: 'Why batch airdrops matter',
        body: 'Airdrops are one of the most effective token distribution mechanisms in crypto. They reward early users, bootstrap liquidity, and drive network effects. But doing them manually — copying addresses, sending one transaction at a time — does not scale.\n\nThe Lester Labs Airdrop Tool lets you upload a CSV of recipient addresses and amounts, review everything before signing, and send to thousands of wallets in a single transaction. The contract handles the math and distribution atomically — if any transfer fails, the whole batch reverts.',
      },
      {
        type: 'callout',
        callout: {
          type: 'info',
          text: 'The Airdrop Tool on LitVM testnet uses test tokens only. No real value is transferred. The flow is identical to mainnet — the only difference is the token you are distributing.',
        },
      },
      {
        type: 'step',
        heading: 'Running your first airdrop',
        steps: [
          {
            title: 'Navigate to the Airdrop Tool',
            body: 'Go to lester-labs.com/airdrop. Connect your wallet and switch to LitVM network. Make sure you hold the tokens you want to distribute in your connected wallet.',
          },
          {
            title: 'Prepare your recipient list',
            body: 'Create a CSV file with two columns: recipient address and amount.\n\naddress,amount\n0x1234...abcd,1000\n0x5678...wxyz,2500\n\nMake sure addresses are valid Ethereum-format (42 characters starting with 0x) and amounts are in the smallest unit of your token.',
          },
          {
            title: 'Upload your CSV',
            body: 'Click Upload CSV and select your file. The tool parses it and shows a preview table: address, amount, and a validation status for each row. Invalid addresses are flagged in red — fix these before proceeding.',
          },
          {
            title: 'Review the distribution summary',
            body: 'The tool shows the total token amount you will be sending, the number of unique recipients, and an estimated gas cost. Review carefully — airdrops are irreversible once the transaction confirms.',
          },
          {
            title: 'Set your parameters',
            body: 'Choose between merkle root mode (for larger distributions where you want to save gas) or direct transfer mode (simpler, recommended for under 500 recipients). Set an optional start time if you want to schedule the airdrop.',
          },
          {
            title: 'Sign and broadcast',
            body: 'Click Distribute and confirm the transaction in your wallet. Once confirmed, tokens appear in each recipient wallet almost instantly. Share the transaction hash as proof of distribution.',
          },
        ],
      },
      {
        type: 'callout',
        callout: {
          type: 'tip',
          text: 'For large airdrops (1000+ recipients), use merkle root mode. It posts one proof to the chain instead of thousands of individual transfers — saving significant gas. Recipients claim their tokens themselves, so there is no gas cost to you for the distribution itself.',
        },
      },
      {
        type: 'text',
        heading: 'Verifying the airdrop on-chain',
        body: 'After the transaction confirms, verify the distribution by searching your address on the LitVM block explorer. The Airdrop contract emits a Transfer event for each successful distribution, making it easy to audit exactly who received what.\n\nFor merkle root mode, the contract stores the merkle root on-chain. Share the merkle proof data with recipients so they can independently verify their inclusion in the tree.',
      },
    ],
    related: ['token-factory-guide', 'token-vesting-guide'],
  },

  {
    slug: 'token-vesting-guide',
    title: 'Token Vesting — schedule releases for teams and investors',
    subtitle: 'How vesting schedules protect your token economy, how the Lester Labs Vesting Factory works, and how to set up cliff and linear release for any wallet.',
    badge: 'Vesting',
    badgeColor: '#06b6d4',
    readTime: '7 min read',
    category: 'dApp Guides',
    heroGradient: 'linear-gradient(135deg, #001a1e 0%, #002a33 50%, #001a1e 100%)',
    heroAccent: '#06b6d4',
    sections: [
      {
        type: 'text',
        heading: 'Why vesting matters for token economies',
        body: 'The biggest risk in any token launch is the VC dump. If your team or investors receive their entire token allocation at launch, there is immediate sell pressure from everyone who wants to realise their gains. This collapses the price and destroys confidence.\n\nVesting solves this by locking tokens and releasing them on a schedule. Team tokens vest linearly over 12 months. Investor tokens might have a 6-month cliff then linear release. This aligns incentives: the team and investors only profit if the token price stays up, which means they are working to build genuine value.',
      },
      {
        type: 'callout',
        callout: {
          type: 'warning',
          text: 'Once a vesting schedule is created on-chain, it cannot be modified or cancelled. This is by design — the immutability is what makes vesting credible to investors. Choose your schedules carefully before deploying.',
        },
      },
      {
        type: 'text',
        heading: 'Key vesting concepts',
        body: 'Before setting up vesting, understand the two parameters that matter most:\n\nCliff: A period at the start where no tokens are released. If you set a 6-month cliff, beneficiaries receive nothing for the first 6 months, then all cliff tokens vest at once.\n\nLinear release: Tokens unlock continuously after the cliff. 12-month linear means 1/365th of the vested amount unlocks every day after the cliff ends.',
      },
      {
        type: 'step',
        heading: 'Setting up a vesting schedule',
        steps: [
          {
            title: 'Go to the Vesting Factory',
            body: 'Navigate to lester-labs.com/vesting. Connect your wallet and ensure you hold the token you want to use for vesting.',
          },
          {
            title: 'Enter the beneficiary address',
            body: 'Paste the wallet address that will receive the vested tokens. This cannot be changed after deployment — make sure the address is correct. Consider a multisig for team vesting to require multiple signatures for any changes.',
          },
          {
            title: 'Set the total allocation',
            body: 'Enter the total number of tokens to be allocated to this beneficiary. This is the full amount that will eventually vest — not the amount vesting per month.',
          },
          {
            title: 'Configure the schedule',
            body: 'Set the start date, cliff duration (0 for immediate release, or 3/6/12 months), and total vesting duration.\n\nCommon configurations:\nTeam: 12-month cliff, 24-month linear total\nAdvisors: 6-month cliff, 12-month linear\nPrivate investors: 0 cliff, 12-month linear',
          },
          {
            title: 'Deploy and deposit',
            body: 'Review the schedule summary and pay the deployment fee. After deployment, transfer the total vested allocation to the newly created vesting contract address. The contract holds the tokens and releases them automatically according to the schedule.',
          },
        ],
      },
      {
        type: 'callout',
        callout: {
          type: 'tip',
          text: 'Use the same vesting schedule across all team members. This signals fairness to your community and prevents accusations of stealth allocations to favourite investors.',
        },
      },
      {
        type: 'text',
        heading: 'How beneficiaries claim vested tokens',
        body: 'Beneficiaries visit the Vesting Factory page, connect their wallet, and the UI shows their vesting schedule: total allocated, amount vested so far, amount claimed, and amount remaining. They click Claim and any vested-but-unclaimed tokens are transferred to their wallet instantly.\n\nNo admin can revoke or redirect tokens once the schedule is set. The contract is the authority.',
      },
    ],
    related: ['token-factory-guide', 'launchpad-how-it-works'],
  },

  // ── Article 11: Complete Guide to LitVM Testnet ──────────────────────────
  {
    slug: 'complete-guide-litvm-testnet',
    title: 'The Complete Guide to LitVM Testnet — Getting Started',
    subtitle: 'Everything you need to get started on LitVM testnet: wallet setup, network configuration, getting test zkLTC, and your first interaction with LitVM DeFi dApps.',
    badge: 'Getting Started',
    badgeColor: '#4ade80',
    readTime: '9 min read',
    category: 'Getting Started',
    heroGradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    heroAccent: '#4ade80',
    sections: [
      {
        type: 'text',
        heading: 'What is LitVM testnet and why use it',
        body: 'LitVM testnet (chain ID 4441) is the sandbox environment for the LitVM blockchain — the Litecoin Virtual Machine powered by Arbitrum Orbit and BitcoinOS. It mirrors the eventual LitVM mainnet exactly: the same EVM, the same contract APIs, the same DeFi infrastructure. The only difference is that testnet tokens have no monetary value, which means you can experiment, deploy, trade, and break things without risking real funds. Every dApp, contract, and tool on Lester Labs is live and fully functional on LitVM testnet.',
      },
      {
        type: 'callout',
        callout: {
          type: 'info',
          text: 'LitVM testnet uses zkLTC as its gas token — not real LTC. You can get free test zkLTC from the LitVM testnet faucet. Testnet zkLTC has no real value and cannot be swapped for mainnet assets.',
        },
      },
      {
        type: 'text',
        heading: 'Which wallet to use on LitVM testnet',
        body: 'Any EVM-compatible wallet works on LitVM testnet. MetaMask is the most widely supported and recommended choice. Rabby, Coinbase Wallet, and Trust Wallet also work. Hardware wallets (Ledger, Trezor) can be used via WalletConnect or by importing the private key into a software wallet for testnet-only use.\n\nFor development workflows, `wagmi` + `viem` integrations work out of the box. For Hardhat or Foundry testing, you can fork testnet state by pointing your JSON-RPC URL at the LitVM testnet RPC.',
      },
      {
        type: 'step',
        heading: 'Adding LitVM testnet to MetaMask',
        steps: [
          {
            title: 'Open MetaMask settings',
            body: 'Click the network selector at the top of MetaMask, then click \"Add network\". Scroll to the bottom and click \"Add a network manually\".',
          },
          {
            title: 'Enter the LitVM testnet configuration',
            body: 'Fill in exactly:\n\nNetwork name: LitVM Testnet\nNew RPC URL: https://liteforge.rpc.caldera.xyz/infra-partner-http\nChain ID: 4441\nCurrency symbol: zkLTC\nBlock explorer URL: https://liteforge.caldera.xyz\n\nThe RPC is provided by Caldera as a LitVM infrastructure partner and gives faster, more consistent responses than the public RPC.',
          },
          {
            title: 'Save and switch',
            body: 'Click Save. MetaMask will switch to LitVM testnet automatically. You will see \"LitVM Testnet\" appear in your network selector and the zkLTC balance displayed in your wallet.',
          },
        ],
      },
      {
        type: 'callout',
        callout: {
          type: 'warning',
          text: 'Always verify the chain ID is 4441 before sending transactions. If your wallet connects to a different chain with the same ID (extremely unlikely), you could send test funds to the wrong place.',
        },
      },
      {
        type: 'text',
        heading: 'Getting test zkLTC on LitVM',
        body: 'The primary method is the LitVM testnet faucet. Connect your wallet (MetaMask or Rabby), make sure you are on LitVM testnet (chain ID 4441), and claim your free test zkLTC. There is a per-wallet claim limit to prevent hoarding — sufficient for development and testing.\n\nFor larger volumes needed during active development, contact the LitVM team via their Discord or Telegram channels. Some projects on LitVM also distribute test tokens directly from their own faucets.\n\nOnce you have test zkLTC, you can interact with every Lester Labs dApp on testnet at zero cost.',
      },
      {
        type: 'step',
        heading: 'Your first interaction with LitVM DeFi',
        steps: [
          {
            title: 'Deploy a test token',
            body: 'Go to lester-labs.com/launch. Connect your wallet, fill in name, symbol, and supply, and deploy. The Token Factory costs 0.05 zkLTC. Your ERC-20 is live on LitVM testnet in under a minute.',
          },
          {
            title: 'Try a LitVM swap',
            body: 'Go to lester-labs.com/swap. You need two tokens to swap — use the Token Factory to create a second one. Approve the router, place your swap, and sign the transaction. The 0.30% fee is charged in test tokens only.',
          },
          {
            title: 'Lock liquidity',
            body: 'After creating a pair on /swap, go to lester-labs.com/locker to lock your LP tokens. Set an unlock date. The lock is permanent and immutably recorded on LitVM testnet.',
          },
          {
            title: 'Explore the block explorer',
            body: 'Visit lester-labs.com/explorer to search for your wallet address, transaction hash, or any contract. Every interaction you have had is recorded and publicly verifiable on LitVM testnet.',
          },
        ],
      },
      {
        type: 'text',
        heading: 'Navigating LitVM testnet vs mainnet',
        body: 'LitVM testnet and mainnet will coexist: testnet is where projects and users experiment before committing real capital, and mainnet is where actual transactions settle. All Lester Labs contracts are deployed on testnet now. The same contracts will be deployed to LitVM mainnet at launch.\n\nBookmark the LitVM testnet explorer (liteforge.caldera.xyz) and the Lester Labs testnet dApp at lester-labs.com. Nothing on mainnet is live yet — but when it is, the interfaces and addresses will be identical.',
      },
    ],
    related: ['what-is-litvm', 'setting-up-litvm-wallet', 'how-to-use-dex-swap'],
  },

  // ── Article 12: Complete Guide to LitVM Airdrop ──────────────────────────
  {
    slug: 'complete-guide-litvm-airdrop',
    title: 'The Complete Guide to LitVM Airdrop — Maximise Your Eligibility',
    subtitle: 'No LitVM airdrop has been officially confirmed. But if one comes, here is how to position yourself: LitVM testnet activity, dApp usage, wallet signals, and the behaviours that typically determine eligibility.',
    badge: 'Airdrop',
    badgeColor: '#fb923c',
    readTime: '8 min read',
    category: 'Ecosystem',
    heroGradient: 'linear-gradient(135deg, #1a0f00 0%, #2e1a00 50%, #1a0f00 100%)',
    heroAccent: '#fb923c',
    sections: [
      {
        type: 'callout',
        callout: {
          type: 'warning',
          text: 'No official LitVM airdrop has been confirmed at the time of writing. Nothing in this guide constitutes a guarantee of eligibility. LitVM and its associated projects have not announced a formal airdrop programme. Proceed on the basis of the activity itself — not the expectation of a reward.',
        },
      },
      {
        type: 'text',
        heading: 'How crypto airdrops typically work',
        body: 'Most major crypto protocols and L2 chains have conducted or announced token distributions. The pattern is consistent: early users of a protocol or chain receive priority allocation, often weighted by transaction frequency, volume, or tenure. Eligibility criteria usually include being an active wallet on the network before a snapshot date — often before the announcement itself.\n\nThis means the only reliable way to position for a potential LitVM airdrop is to genuinely use LitVM testnet and mainnet when it launches. Activity before the announcement is the strongest signal projects use.',
      },
      {
        type: 'callout',
        callout: {
          type: 'tip',
          text: 'The strongest historical predictor of airdrop eligibility is being an active wallet on a chain before the token is announced — not after. Start using LitVM dApps now, on testnet, while the window is open.',
        },
      },
      {
        type: 'text',
        heading: 'Step-by-step: maximising your LitVM eligibility signal',
        body: 'Below are the concrete steps to build the strongest possible eligibility signal for a potential LitVM airdrop. These are the same steps that have been associated with eligibility in comparable protocols and L2 airdrops.',
      },
      {
        type: 'step',
        heading: 'Step 1: Set up your LitVM wallet',
        steps: [
          {
            title: 'Use a dedicated wallet',
            body: 'Consider using a wallet that has no prior history with the LitVM ecosystem — new EOAs tend to receive more attention in eligibility models than wallets that already have a long history on the chain.',
          },
          {
            title: 'Add LitVM testnet to MetaMask or Rabby',
            body: 'Network name: LitVM Testnet, RPC: https://liteforge.rpc.caldera.xyz/infra-partner-http, Chain ID: 4441, Currency: zkLTC, Explorer: https://liteforge.caldera.xyz.',
          },
          {
            title: 'Secure your seed phrase',
            body: 'Write down your seed phrase. Never share it. Use a hardware wallet if possible for the wallet you intend to use long-term on LitVM mainnet.',
          },
        ],
      },
      {
        type: 'step',
        heading: 'Step 2: Use LitVM DeFi dApps consistently on testnet',
        steps: [
          {
            title: 'Deploy a test token',
            body: 'Use the Token Factory at lester-labs.com/launch to deploy an ERC-20 on LitVM testnet. It costs 0.05 zkLTC. This registers your wallet as an active deployer on LitVM — a meaningful signal for any future eligibility model.',
          },
          {
            title: 'Run a LitVM swap',
            body: 'Go to lester-labs.com/swap. Create two test tokens with the Token Factory and swap between them. Swap activity is one of the strongest signals used in airdrop eligibility — it demonstrates genuine chain usage.',
          },
          {
            title: 'Use the Launchpad',
            body: 'Run a test presale on lester-labs.com/launchpad. Even a small raise with your own tokens demonstrates engagement with LitVM infrastructure. ILO participation signals deep protocol engagement.',
          },
          {
            title: 'Use the Airdrop Tool',
            body: 'Send a test batch distribution at lester-labs.com/airdrop. Demonstrates use of the full DeFi stack — not just swapping — and registers your wallet across multiple contract interactions.',
          },
          {
            title: 'Lock LP tokens',
            body: 'After providing liquidity on /swap, lock your LP tokens at lester-labs.com/locker. LP locking is a strong signal of long-term commitment to a chain ecosystem.',
          },
        ],
      },
      {
        type: 'step',
        heading: 'Step 3: Stay active over time',
        steps: [
          {
            title: 'Activity frequency matters',
            body: 'Most airdrop eligibility models weight transaction count and tenure. Regular activity over weeks and months matters more than a single burst of transactions. Spread your testnet activity over time.',
          },
          {
            title: 'Use multiple LitVM dApps',
            body: 'The more contracts you interact with, the richer your on-chain signal. Use the block explorer at lester-labs.com/explorer to look up your own address and verify your activity history.',
          },
          {
            title: 'Track your activity on the LitVM block explorer',
            body: 'Search your wallet address at lester-labs.com/explorer. Every transaction, token transfer, and contract interaction is recorded. Use this to confirm your wallet is registering activity correctly.',
          },
        ],
      },
      {
        type: 'step',
        heading: 'Step 4: Follow LitVM and Lester Labs for official announcements',
        steps: [
          {
            title: 'Follow LitVM official channels',
            body: 'Bookmark litvm.com and follow their official X/Twitter and Telegram accounts. Official announcements about token launches, mainnet dates, and airdrop programmes will come through these channels first.',
          },
          {
            title: 'Follow Lester Labs',
            body: 'Lester Labs is the primary dApp infrastructure provider on LitVM. Follow @lesterlabshq on X for updates on contract deployments, new features, and any ecosystem announcements that could relate to airdrop eligibility.',
          },
          {
            title: 'Join the LitVM community',
            body: 'Participate in the LitVM Discord and Telegram. Active community membership is often tracked by projects and can be a factor in eligibility for grants, early access, and token distributions.',
          },
        ],
      },
      {
        type: 'text',
        heading: 'What NOT to do',
        body: 'Airdrop farmers who create hundreds of wallets to farm eligibility are often penalised rather than rewarded — Sybil detection has become sophisticated. Use one or two wallets genuinely. The goal is to demonstrate real usage, not to game the system.\n\nSimilarly, do not send funds to random wallets in an attempt to simulate activity. Clean, purposeful transactions across real dApps are the only signal worth building.',
      },
      {
        type: 'callout',
        callout: {
          type: 'tip',
          text: 'The best LitVM airdrop strategy is to forget about the airdrop and focus on genuinely exploring the ecosystem. You will learn more, build better habits, and your activity will look authentic — which is exactly what eligibility models reward.',
        },
      },
    ],
    related: ['complete-guide-litvm-testnet', 'what-is-litvm', 'how-to-use-dex-swap', 'launchpad-how-it-works'],
  },

  // ── Article 13: LitVM Block Explorer ────────────────────────────────────
  {
    slug: 'litvm-block-explorer',
    title: 'LitVM Block Explorer — Track Transactions, Wallets, and Tokens',
    subtitle: 'A complete guide to the LitVM block explorer: how to search for transactions, monitor wallet activity, track token transfers, and verify contract deployments on LitVM using the Lester Labs explorer.',
    badge: 'Block Explorer',
    badgeColor: '#22d3ee',
    readTime: '6 min read',
    category: 'Ecosystem',
    heroGradient: 'linear-gradient(135deg, #001a1e 0%, #003333 50%, #001a1e 100%)',
    heroAccent: '#22d3ee',
    sections: [
      {
        type: 'text',
        heading: 'What is the LitVM block explorer',
        body: 'A block explorer is a search engine for a blockchain. It lets you look up any transaction, wallet address, contract deployment, or token transfer that has ever occurred on LitVM — without needing a wallet or any permission. The LitVM block explorer is available at lester-labs.com/explorer, powered by a LitVM RPC node with full indexing support.\n\nEvery action on LitVM — a token swap, a contract deployment, a governance vote, an airdrop distribution — generates a transaction that is permanently recorded on the chain and visible through the explorer.',
      },
      {
        type: 'callout',
        callout: {
          type: 'info',
          text: 'The LitVM block explorer is fully public. You do not need to connect a wallet or have any balance to use it. You can look up any LitVM address, transaction, or contract at any time.',
        },
      },
      {
        type: 'text',
        heading: 'How to search on the LitVM block explorer',
        body: 'The LitVM block explorer at lester-labs.com/explorer accepts three primary search types: wallet addresses, transaction hashes, and block numbers. Paste any Ethereum-format address (0x...) into the search bar to see its full history.',
      },
      {
        type: 'step',
        heading: 'Searching for a wallet address',
        steps: [
          {
            title: 'Paste the address',
            body: 'Paste any LitVM wallet address into the search bar at lester-labs.com/explorer. Press Enter.',
          },
          {
            title: 'Read the address overview',
            body: 'The explorer shows the current balance (in zkLTC), the total number of transactions sent and received, and the age of the wallet (first seen at block). For contracts, it additionally shows the deployed code.',
          },
          {
            title: 'Review the transaction history',
            body: 'Scrolling down shows every transaction involving that address: swaps, transfers, contract deployments, LP interactions, governance votes. Each row shows the method called, the amount, the gas used, and a link to the full transaction.',
          },
          {
            title: 'Check token holdings',
            body: 'The Tokens tab on an address page shows every ERC-20 token held by that wallet and the current balance. Useful for checking whether a target wallet holds a specific project token.',
          },
        ],
      },
      {
        type: 'step',
        heading: 'Reading a LitVM transaction',
        steps: [
          {
            title: 'Find the transaction hash',
            body: 'Every LitVM transaction has a unique hash (0x...). On lester-labs.com/explorer, paste the hash into the search bar to open the transaction detail page.',
          },
          {
            title: 'Check the status',
            body: 'The top of the transaction page shows Status (Success / Failed), the block number it was included in, and the gas used. A confirmed transaction shows the block number and a link to the block.',
          },
          {
            title: 'Read the method called',
            body: 'For contract interactions, the Method field shows the function name (e.g. \"swapExactETHForTokens\" or \"create\" for a token deployment). This tells you what the transaction did without reading the raw input data.',
          },
          {
            title: 'Verify token transfers',
            body: 'The Tokens Transferred section shows every ERC-20 token moved in the transaction: the token, the amount, and the from/to addresses. For a swap, this shows input and output tokens.',
          },
        ],
      },
      {
        type: 'step',
        heading: 'Exploring blocks',
        steps: [
          {
            title: 'Navigate to the block explorer',
            body: 'Go to lester-labs.com/explorer/block/[number] — or click any block number from a transaction page. The block page shows all transactions included in that block.',
          },
          {
            title: 'Read block metadata',
            body: 'Each block shows its number, timestamp, gas used, gas limit, transaction count, and the miner or validator address. Gas used vs limit tells you how full the block was.',
          },
          {
            title: 'Monitor chain health',
            body: 'Watch block times and gas usage over time at lester-labs.com/explorer/health. Consistent block times and moderate gas usage indicate a healthy, uncongested LitVM network.',
          },
        ],
      },
      {
        type: 'step',
        heading: 'Tracking tokens on LitVM',
        steps: [
          {
            title: 'Find a token contract',
            body: 'Search for a token by its contract address on lester-labs.com/explorer. The Token page shows the token name, symbol, total supply, decimals, and the deployer address.',
          },
          {
            title: 'View token holders',
            body: 'The Holders tab shows the top wallets holding the token and their balance. Useful for verifying distribution and checking whether team or investor wallets hold large portions.',
          },
          {
            title: 'Find token transfers',
            body: 'The Transfers tab shows every transfer of that token: sender, recipient, amount, and transaction hash. Useful for auditing airdrop distributions or tracking large wallet movements.',
          },
        ],
      },
      {
        type: 'text',
        heading: 'Verifying your own LitVM activity',
        body: 'After using any Lester Labs dApp on LitVM — deploying a token, running a swap, creating an LP position, locking tokens — you can verify the result on the explorer. Search your wallet address and confirm the transaction appears. This is the definitive proof of on-chain activity: the block explorer records everything permanently, without any reliance on the dApp being online.\n\nThis is one of the core properties of blockchain: public verifiability. The LitVM block explorer at lester-labs.com/explorer is your interface to that permanent record.',
      },
    ],
    related: ['what-is-litvm', 'complete-guide-litvm-testnet', 'how-to-use-dex-swap'],
  },
]

export function getArticle(slug: string): TutorialArticle | undefined {
  return TUTORIALS.find(a => a.slug === slug)
}

export function getRelatedArticles(slugs: string[]): TutorialArticle[] {
  return slugs.map(getArticle).filter((a): a is TutorialArticle => a !== undefined)
}

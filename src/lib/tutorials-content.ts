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
    subtitle: 'A cautious overview of the LitVM LiteForge testnet, its EVM execution environment, and the distinction between current network state and the published roadmap.',
    badge: 'Ecosystem',
    badgeColor: '#818cf8',
    readTime: '6 min read',
    category: 'Getting Started',
    heroGradient: 'linear-gradient(135deg, #0f0c29 0%, #1a1a3e 50%, #242043 100%)',
    heroAccent: '#818cf8',
    sections: [
      {
        type: 'text',
        heading: 'Current network and published architecture',
        body: 'Litecoin and EVM chains use different execution models. LitVM publishes an Arbitrum Orbit/Nitro architecture intended to provide an EVM-compatible environment alongside BitcoinOS bridging and a phased settlement roadmap.\n\nLiteForge is the current testnet (chain ID 4441). A testnet deployment is not proof that every roadmap component, bridge, sequencer, proof system, settlement path, or mainnet parameter is live or final. Verify the current phase in LitVM’s official documentation before relying on an architectural claim.',
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
        heading: 'Do not collapse the roadmap into a security guarantee',
        body: 'LitVM’s published architecture describes Arbitrum Nitro execution plus Succinct SP1 validity proofs and phased Litecoin anchoring. Those components have different trust, liveness, settlement, and finality properties.\n\nDo not assume a transaction is currently settled on Litecoin, that a bridge is available for a particular asset, or that a marketing description proves decentralization. For a material transaction, identify the exact chain, bridge contracts, current settlement layer, upgrade controls, sequencer status, and withdrawal conditions from official sources.',
      },
      {
        type: 'image',
        src: '/images/tutorials/litvm-diagram.svg',
        alt: 'LitVM architecture diagram showing validity proof generation',
        caption: 'Conceptual architecture only. Confirm the currently deployed proving, sequencing, bridge, and settlement components in official LitVM documentation.',
      },
      {
        type: 'text',
        heading: 'EVM compatibility has documented differences',
        body: 'LitVM supports Solidity contracts and common Ethereum tooling, but “EVM-compatible” does not mean every Ethereum assumption is identical. LitVM’s official documentation identifies differences in block numbers, timestamps, gas limits, randomness, and cross-chain address behaviour.\n\nTest contracts against chain ID 4441 and the exact current network. Never carry testnet addresses, approvals, gas assumptions, or bytecode claims into a future mainnet deployment without a separate review.',
      },
      {
        type: 'step',
        heading: 'How a transaction flows on LitVM',
        steps: [
          {
            title: 'User sends a transaction',
            body: 'A wallet should show chain ID 4441, the exact target, function, value, and decoded parameters before the user approves a testnet transaction.',
          },
          {
            title: 'The network orders and executes it',
            body: 'The LiteForge execution environment processes the transaction. The exact sequencer and proving status is an operational network fact; check current official status rather than inferring it from this website.',
          },
          {
            title: 'The wallet receives a transaction hash',
            body: 'Use the source-pinned LiteForge explorer or an independently selected RPC to verify the receipt, status, block, sender, recipient, value, and logs.',
          },
          {
            title: 'Apply the current settlement assumptions',
            body: 'Confirmation on LiteForge is not a generic promise of Litecoin finality. For bridge or real-value decisions, verify the currently deployed settlement phase and its withdrawal/finality rules.',
          },
        ],
      },
      {
        type: 'callout',
        callout: {
          type: 'tip',
          text: 'This is a testnet. A transaction receipt proves execution on the connected chain; it does not by itself prove a roadmap component, bridge backing, mainnet availability, or a particular finality guarantee.',
        },
      },
      {
        type: 'text',
        heading: 'What you can build on LitVM — DeFi, tokens, and beyond',
        body: 'An EVM-compatible testnet can be used to test token, exchange, governance, game, identity, and other smart-contract designs. Each application still needs its own security review, and a test deployment does not establish production readiness.\n\nLiteForge uses zkLTC as its native gas token. Testnet zkLTC is for testing and has no represented monetary value on this site. Fees, capacity, bridge support, and mainnet behaviour must be checked independently.',
      },
    ],
    related: ['setting-up-litvm-wallet', 'understanding-zklktc'],
  },

  {
    slug: 'setting-up-litvm-wallet',
    title: 'Setting up your LitVM wallet in 5 minutes',
    subtitle: 'Configure a compatible injected wallet for LitVM LiteForge. During recovery, this frontend intentionally exposes only one injected-wallet connector.',
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
        body: 'Before starting, use a disposable testnet-only wallet with no valuable approvals or assets, and independently locate LitVM’s official testnet hub. You need the published LiteForge network parameters and a small amount of testnet zkLTC for gas.\n\nDo not send real LTC to Lester Labs, import a valuable wallet for a testnet task, or enter a private key or recovery phrase into any website.',
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
            body: 'Cross-check these values against LitVM’s official testnet hub before adding them:\n\n• Network name: LitVM LiteForge\n• New RPC URL: https://liteforge.rpc.caldera.xyz/http\n• Chain ID: 4441\n• Currency symbol: zkLTC\n• Block explorer URL: https://liteforge.explorer.caldera.xyz\n\nA network-add prompt can be spoofed. Cancel if the wallet displays a different chain ID or endpoint.',
          },
          {
            title: 'Click Save',
            body: 'After saving, select "LitVM LiteForge" in MetaMask and re-check chain ID 4441, the RPC endpoint, and the explorer before connecting this site.',
          },
        ],
      },
      {
        type: 'code',
        lang: 'json',
        content: `// LitVM LiteForge configuration
{
  "chainId": "0x1159",          // 4441 in hex
  "chainName": "LitVM LiteForge",
  "nativeCurrency": {
    "name": "zkLTC",
    "symbol": "zkLTC",
    "decimals": 18
  },
  "rpcUrls": ["https://liteforge.rpc.caldera.xyz/http"],
  "blockExplorerUrls": ["https://liteforge.explorer.caldera.xyz"]
}`,
      },
      {
        type: 'callout',
        callout: {
          type: 'warning',
          text: 'Chain ID alone does not authenticate a wallet RPC. Before every prompt, require chain ID 4441 and independently cross-check the wallet’s RPC and explorer against LitVM’s official LiteForge parameters. Lester’s reads use a source-pinned endpoint, which can differ from a wallet provider you configured.',
        },
      },
      {
        type: 'text',
        heading: 'Getting testnet zkLTC',
        body: 'Locate the current LiteForge faucet from LitVM’s official testnet hub (testnet.litvm.com), then paste only the public address of a disposable test wallet. Faucet availability, limits, and response times can change.\n\nA faucet does not need your seed phrase or private key, and Lester Labs does not sell testnet zkLTC or arrange private gas transfers.',
      },
    ],
    related: ['what-is-litvm', 'understanding-zklktc'],
  },

  {
    slug: 'understanding-zklktc',
    title: 'Understanding zkLTC — the fuel of LitVM',
    subtitle: 'zkLTC is the native gas token on LiteForge. Distinguish testnet gas from any future or real-value bridge representation.',
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
        body: 'LiteForge labels its native testnet gas asset zkLTC. It is represented in EVM balances and transaction value, not as an ERC-20 merely because ERC-20 tooling can also wrap or represent assets on the chain. Testnet zkLTC is for gas testing and has no represented monetary value on this site.\n\nDo not infer a particular LTC backing, redemption right, bridge route, or mainnet economic model from the testnet symbol. Those properties require separate evidence from the exact deployed bridge and official current documentation.',
      },
      {
        type: 'callout',
        callout: {
          type: 'info',
          text: 'zkLTC obtained for LiteForge testing is testnet gas. Lester Labs makes no claim that it is redeemable, bridged, or valuable, and does not announce LitVM mainnet or bridge availability.',
        },
      },
      {
        type: 'text',
        heading: 'Bridge descriptions require deployed-contract evidence',
        body: 'LitVM’s official architecture describes BitcoinOS Grail for LTC↔zkLTC bridging and a phased mainnet rollout. A design description is not a reason to send funds to an address supplied by a search result, social post, support account, or this independent website.\n\nBefore using any real-value bridge, verify the official UI through an independently located LitVM source, the source and destination chains, exact contracts and runtime code, backing and redemption model, upgrade/admin controls, fees, limits, finality, and incident status. Start with a minimal amount only after that review.',
      },
      {
        type: 'step',
        heading: 'How to get zkLTC (testnet)',
        steps: [
          {
            title: 'Locate the official testnet hub',
            body: 'Navigate independently to testnet.litvm.com and follow the current LiteForge faucet link. Do not use a faucet link from an unsolicited message or advertisement.',
          },
          {
            title: 'Switch to LitVM testnet',
            body: 'Verify chain ID 4441 and the published RPC/explorer before approving a network-add request. A faucet can usually accept a public address without wallet connection.',
          },
          {
            title: 'Claim your test zkLTC',
            body: 'Request test gas for a disposable public address. Availability, amount, rate limits, and delivery time are controlled by the faucet operator and may change.',
          },
          {
            title: 'Keep real-value bridging separate',
            body: 'Do not infer a live mainnet bridge from testnet instructions. Reassess official contracts, backing, fees, withdrawal rules, and security status when a real-value service is separately announced.',
          },
        ],
      },
      {
        type: 'callout',
        callout: {
          type: 'tip',
          text: 'Gas cost and network capacity are time-dependent testnet observations, not promises. Read the current gas estimate in your wallet and do not convert testnet zkLTC into a claimed USD cost or LTC value without an independently verified market and backing model.',
        },
      },
    ],
    related: ['setting-up-litvm-wallet', 'what-is-litvm'],
  },

  {
    slug: 'launchpad-how-it-works',
    title: 'LitVM Launchpad — Legacy Recovery and Future Design',
    subtitle: 'Why the current legacy factory is creation-disabled, which recovery actions remain available, and how a future reviewed Launchpad is intended to work.',
    badge: 'Launchpad',
    badgeColor: '#a78bfa',
    readTime: '8 min read',
    category: 'dApp Guides',
    heroGradient: 'linear-gradient(135deg, #1a0f2e 0%, #2a1a4a 50%, #1a0f2e 100%)',
    heroAccent: '#a78bfa',
    sections: [
      {
        type: 'text',
        heading: 'Current operational status',
        body: 'Both source-pinned ILO factories and their connector are retired legacy deployments whose treasury route points at the compromised former authority. New ILO creation is disabled, and the application blocks additional funding, contributions, whitelist changes, and finalization on legacy ILOs. Do not send assets directly to them.\n\nHistorical cancellation, refund, token claim, LP claim, and excess-asset recovery paths remain visible only when the individual contract state and connected wallet role permit them. A separately reviewed future factory, connector, and child runtime must be explicitly pinned before new creation can be enabled.',
      },
      {
        type: 'step',
        heading: 'Future design reference — currently disabled',
        steps: [
          {
            title: 'Have a deployed ERC-20 token',
            body: 'A future launch would require an independently reviewed ERC-20 token address. The current Token Factory is also a retired paid-write target, so do not deploy or pay through it during containment.',
          },
          {
            title: 'Navigate to the Launchpad',
            body: 'The current Launchpad is for historical discovery and recovery. Its Create flow remains disabled until a separately reviewed replacement factory is pinned.',
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
            body: 'A future reviewed child would enforce start and end timestamps and its configured cap. This describes intended behavior only; no legacy ILO should be configured or funded.',
          },
          {
            title: 'Configure LP settings',
            body: 'A future reviewed child would record a liquidity percentage and LP lock duration. More deposited liquidity is not a promise of safety, fair pricing, market depth, or project legitimacy.',
          },
          {
            title: 'Deploy and deposit',
            body: 'Do not perform this step on either source-pinned legacy factory or any existing legacy ILO. In a future approved deployment, the application will re-authenticate the pinned replacement factory before accepting the creation fee or showing funding instructions.',
          },
        ],
      },
      {
        type: 'callout',
        callout: {
          type: 'warning',
          text: 'Do not create, fund, contribute to, change a whitelist on, or finalize any legacy ILO. Use only the narrowly labelled recovery action that the application exposes for the exact source-authenticated historical contract.',
        },
      },
      {
        type: 'text',
        heading: 'How future LP creation is intended to work',
        body: 'In a separately reviewed future deployment, an ILO would hand launch liquidity to a new `UniSwapConnector`. Before seeding, it must verify factory `feeTo` equals the approved treasury and the distinct `feeToSetter` equals the approved controller. A third, single-use gas EOA deploys the attested artifacts. The current legacy connector embeds the retired treasury and must not be reused.',
      },
    ],
    related: ['token-factory-guide', 'liquidity-locker-guide'],
  },

  {
    slug: 'how-to-use-dex-swap',
    title: 'LitVM DEX — Legacy Recovery and Replacement Checks',
    subtitle: 'Why new swaps and liquidity writes are disabled, how to inspect bounded reserve data, and how authenticated legacy LP or wrapped-native recovery works.',
    badge: 'DEX',
    badgeColor: '#E44FB5',
    readTime: '6 min read',
    category: 'dApp Guides',
    heroGradient: 'linear-gradient(135deg, #140811 0%, #26111f 50%, #140811 100%)',
    heroAccent: '#E44FB5',
    sections: [
      {
        type: 'text',
        heading: 'Current containment status',
        body: 'The visible factory, router, wrapped-native contract, and pairs are compromised legacy deployments. New swaps, token approvals for trading, wrapping, pool creation, and liquidity additions are disabled. Router quotes and reserve ratios remain untrusted read-only observations; they are not oracle prices or evidence that a transaction is safe.\n\nThe legacy pair directly routed 0.20% of measured swap input to mutable `feeTo` and retained roughly 0.10% in-pool. That unusual extra recipient is not an arbitrary drain by itself, but it is a plausible malicious-transaction heuristic and could be redirected by the compromised `feeToSetter`.',
      },
      {
        type: 'step',
        heading: 'Existing-position recovery checklist',
        steps: [
          {
            title: 'Verify the network independently',
            body: 'Cross-check LiteForge chain ID 4441, RPC https://liteforge.rpc.caldera.xyz/http, native currency zkLTC, and explorer https://liteforge.explorer.caldera.xyz against LitVM’s official testnet hub before opening any wallet prompt.',
          },
          {
            title: 'Authenticate the exact legacy tuple',
            body: 'For an existing LP position, use only a source-pinned factory/router/wrapped-native tuple. Verify exact runtime hashes, pair token addresses, factory `getPair`, and router `factory()` / `WETH()` values. Do not accept an address from a search result, social post, message, or mutable environment variable.',
          },
          {
            title: 'Do not approve or swap',
            body: 'A reserve quote does not authorize a trade. Do not grant a token allowance or submit a swap to the retired router. For recovery, approve only the exact LP amount immediately before the source-pinned removal call and revoke any residual allowance afterward.',
          },
          {
            title: 'Remove only an authenticated existing position',
            body: 'Use explicit minimum outputs, a short deadline, and the connected wallet as recipient for `removeLiquidity` or `removeLiquidityETH`. New deposits, pool creation, wrapping, and liquidity additions remain disabled.',
          },
          {
            title: 'Verify the recovery receipt',
            body: 'Confirm the exact target, function, calldata, value, minimum outputs, deadline, and recipient in the wallet. After confirmation, verify token transfers and the remaining allowance through an independently selected RPC or explorer.',
          },
        ],
      },
      {
        type: 'callout',
        callout: {
          type: 'tip',
          text: 'Existing wrapped-native tokens may be withdrawn only through the exact source-pinned legacy wrapper after runtime verification. New wrapping remains disabled.',
        },
      },
      {
        type: 'code',
        lang: 'json',
        content: `// LitVM LiteForge configuration
{
  "chainId": "0x1159",
  "chainName": "LitVM LiteForge",
  "nativeCurrency": {
    "name": "zkLTC",
    "symbol": "zkLTC",
    "decimals": 18
  },
  "rpcUrls": ["https://liteforge.rpc.caldera.xyz/http"],
  "blockExplorerUrls": ["https://liteforge.explorer.caldera.xyz"]
}`,
      },
      {
        type: 'text',
        heading: 'Replacement economics and role separation',
        body: 'The prepared replacement restores canonical Uniswap V2 pair economics: the 0.30% fee remains in-pool and an enabled protocol fee is realized through standard LP-token minting on a later liquidity event, not a fixed transfer from every swap input. Factory `feeTo` must equal the approved treasury; the distinct `feeToSetter` must equal the approved controller. The replacement remains inactive until its exact runtimes, role graph, deployment attestation, and clean served frontend are source-pinned.',
      },
    ],
    related: ['setting-up-litvm-wallet', 'launchpad-how-it-works', 'liquidity-locker-guide'],
  },

  {
    slug: 'token-factory-guide',
    title: 'Token Factory — Legacy Review and Replacement Readiness',
    subtitle: 'Why token creation is disabled, how to inspect historical child tokens, and what must be verified before a replacement factory can activate.',
    badge: 'Token Factory',
    badgeColor: '#6366f1',
    readTime: '4 min read',
    category: 'dApp Guides',
    heroGradient: 'linear-gradient(135deg, #0f0c29 0%, #1e1a4a 50%, #0f0c29 100%)',
    heroAccent: '#6366f1',
    sections: [
      {
        type: 'text',
        heading: 'Current containment status',
        body: 'The legacy Token Factory remains owned by the compromised former controller. New token creation and the historical 0.05 zkLTC fee write are disabled. Do not call `createToken` directly or send zkLTC to the factory.\n\nHistorical LesterToken children combined OpenZeppelin ERC-20 modules with custom decimals and optional owner minting, holder burning, and owner pause controls. Each child has its own transferable owner; replacing the factory does not rotate that owner or make a child trustworthy.',
      },
      {
        type: 'step',
        heading: 'Reviewing a historical factory token',
        steps: [
          {
            title: 'Start without connecting a wallet',
            body: 'Open the read-only token or explorer view. Do not connect merely to inspect a public contract, and do not bypass the disabled creation form.',
          },
          {
            title: 'Verify provenance and identity',
            body: 'Confirm the exact token address, creation transaction, source-pinned factory event, runtime code, name, symbol, decimals, supply, and current owner. A matching name or symbol is spoofable and does not prove provenance.',
          },
          {
            title: 'Inspect privileged features',
            body: 'Determine whether the current token owner can mint additional supply or pause transfers, and whether holders can burn. Treat owner-transfer history and current authority as part of the review.',
          },
          {
            title: 'Wait for replacement activation',
            body: 'A replacement may activate only after a distinct controller, treasury, and single-use deployer, exact runtime attestation, and explicit frontend paid-write allowlist are source-pinned. Until then, do not approve or pay a factory.',
          },
        ],
      },
      {
        type: 'callout',
        callout: {
          type: 'tip',
          text: 'The Lester token tracker scans a bounded newest factory-event window; it is not a complete index. Keep the exact creation receipt and address. Testnet and RPC history availability are not perpetual-storage guarantees.',
        },
      },
    ],
    related: ['launchpad-how-it-works', 'liquidity-locker-guide'],
  },

  {
    slug: 'liquidity-locker-guide',
    title: 'Liquidity Locker — Legacy Withdrawal and Replacement Checks',
    subtitle: 'Why new locks are disabled, what a lock record does and does not prove, and how an authenticated matured legacy withdrawal works.',
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
        body: 'An LP token represents a claim on a particular pair. A locker can custody specified LP tokens until a timestamp, but it does not prove token value, market depth, owner honesty, contract safety, or project legitimacy.\n\nThe source-reviewed legacy record has no setter to change its withdrawer or timestamp after creation. That property does not make the compromised factory safe for new deposits, and the underlying LP may belong to a retired DEX.',
      },
      {
        type: 'callout',
        callout: {
          type: 'info',
          text: 'New locks and LP-token approvals to the legacy locker are disabled. Only a source-authenticated, matured record for which the connected wallet is the recorded withdrawer is eligible for recovery.',
        },
      },
      {
        type: 'step',
        heading: 'Withdrawing an existing matured lock',
        steps: [
          {
            title: 'Open the source-pinned locker view',
            body: 'Navigate independently to lester-labs.com/locker. Do not paste a locker address from a chat, social post, search result, or mutable environment value.',
          },
          {
            title: 'Authenticate the record',
            body: 'Verify the exact locker runtime and read the lock token, amount, unlock timestamp, withdrawer, and withdrawal state. Confirm the connected wallet exactly matches the recorded withdrawer.',
          },
          {
            title: 'Confirm maturity and target',
            body: 'The existing timestamp cannot be edited. Wait until it has passed, then confirm the proposed call is zero-value `withdraw(lockId)` to the exact source-pinned locker.',
          },
          {
            title: 'Withdraw and verify',
            body: 'Review the decoded transaction, sign only if every check matches, and verify the LP-token transfer and updated withdrawal state through an independently selected RPC or explorer.',
          },
        ],
      },
    ],
    related: ['launchpad-how-it-works', 'token-factory-guide'],
  },

  {
    slug: 'the-ledger-guide',
    title: 'The Ledger — Historical Reads and Replacement Checks',
    subtitle: 'How legacy messages were recorded, why paid posting is disabled, and the limits of testnet/RPC data availability.',
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
        body: 'EVM transactions include input data containing ABI-encoded function arguments. A successful legacy `post(message)` call placed message bytes in that transaction input and emitted a `MessagePosted` event. The contract has no function to edit a confirmed transaction.\n\nAvailability still depends on the LiteForge testnet and an RPC, archive, or explorer retaining the relevant history. The Lester website is a paginated event/RPC view, not a complete archive or a perpetual-storage guarantee. The legacy owner could change the fee and treasury route, so the system was not admin-free.',
      },
      {
        type: 'callout',
        callout: {
          type: 'warning',
          text: 'A confirmed transaction cannot be edited through the Ledger contract, but testnet continuity and historical RPC availability are not guaranteed. Paid posting to the legacy Ledger is disabled.',
        },
      },
      {
        type: 'step',
        heading: 'Reading and verifying a historical message',
        steps: [
          {
            title: 'Go to The Ledger',
            body: 'Navigate independently to lester-labs.com/ledger. A wallet is not required to read the sampled feed.',
          },
          {
            title: 'Locate the exact transaction',
            body: 'Use the displayed hash to retrieve the exact transaction, status, block, sender, target, input data, and event log through an independently selected RPC or explorer.',
          },
          {
            title: 'Do not post during containment',
            body: 'The historical 0.01 zkLTC minimum fee and mutable treasury route belong to the compromised legacy deployment. Do not call `post()` directly or send it zkLTC.',
          },
          {
            title: 'Interpret the record narrowly',
            body: 'The sender address proves only which key authorized the transaction. It does not prove a real-world identity, message accuracy, project endorsement, or perpetual availability.',
          },
        ],
      },
      {
        type: 'text',
        heading: 'Reading The Ledger without a wallet',
        body: 'The Lester feed requests historical events through LitVM RPC and presents a bounded, paginated view. When exact completeness matters, query a separately selected archival data source and preserve the transaction hash and receipt. No single public RPC or website is assumed to retain every historical record indefinitely.',
      },
    ],
    related: ['what-is-litvm'],
  },

  {
    slug: 'airdrop-tool-guide',
    title: 'LitVM Airdrop Tool — Batch Token Distribution on LitVM',
    subtitle: 'How to review recipient lists locally during containment and what must be verified before replacement distribution writes can resume.',
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
        body: 'Batch distribution is an operational tool for a sender who already has a reviewed recipient list and a legitimate reason to transfer test assets. It is not evidence of a reward programme, token legitimacy, affiliation, or user eligibility.\n\nThe Lester Labs tool validates CSV recipient addresses and display amounts locally, shows the complete send list, and—only after the reviewed replacement is activated—will split requested ERC-20 or zkLTC transfers into batches of up to 200 recipient entries. Each batch is a separate wallet transaction.',
      },
      {
        type: 'callout',
        callout: {
          type: 'info',
          text: 'Distribution and token-approval writes are currently disabled. Local parsing and reports do not authorize a transaction. Future testnet or mainnet contracts, addresses, limits, and fees require separate verification.',
        },
      },
      {
        type: 'step',
        heading: 'Preparing and reviewing a distribution locally',
        steps: [
          {
            title: 'Navigate to the Airdrop Tool',
            body: 'Go independently to lester-labs.com/airdrop. You can prepare and inspect a recipient list without approving a token or signing a distribution transaction.',
          },
          {
            title: 'Prepare your recipient list',
            body: 'Create a CSV file with two columns: recipient address and amount.\n\naddress,amount\n0x1234...abcd,1000\n0x5678...wxyz,2500\n\nMake sure addresses are valid Ethereum-format (42 characters starting with 0x). Enter normal display amounts, such as 1.5 or 1000; the tool reads the token decimals and converts each amount to base units exactly once when building the transaction.',
          },
          {
            title: 'Upload your CSV',
            body: 'Click Upload CSV and select your file. Parsing stays in your browser; the CSV is not uploaded to a Lester Labs server. The complete review table shows each address, amount, and validation status. Use its page controls to inspect every row that will be submitted, and fix any entries flagged in red before proceeding.',
          },
          {
            title: 'Review the distribution summary',
            body: 'The tool shows the total amount, validated recipient count, batch count, network, contract readiness, and the wallet confirmations that will be requested. Review carefully: each confirmed batch is irreversible.',
          },
          {
            title: 'Stop before approval or broadcast',
            body: 'During containment, do not approve the legacy Disperse contract or sign token/native distribution batches. After a replacement is independently activated, each approval must name the exact source-pinned spender and amount, and each bounded batch must be reviewed as a separate transaction.',
          },
        ],
      },
      {
        type: 'callout',
        callout: {
          type: 'tip',
          text: 'Preserve the local review report, but do not treat it as a receipt. Once a replacement is active, begin with a small test batch, verify every recipient and amount independently, and preserve confirmed hashes until the sequence is complete.',
        },
      },
      {
        type: 'text',
        heading: 'Verifying the airdrop on-chain',
        body: 'No transaction should be produced during containment. After a separately attested replacement is activated, open each confirmed hash in an independently selected explorer or RPC. For ERC-20 distributions, verify Transfer logs and base-unit values against the report; for native zkLTC, verify transaction value and the balance changes supported by the data source. Duplicate addresses remain separate recipient entries and are not unique-wallet counts.',
      },
    ],
    related: ['token-factory-guide', 'token-vesting-guide'],
  },

  {
    slug: 'token-vesting-guide',
    title: 'Token Vesting — Legacy Release and Replacement Checks',
    subtitle: 'Why new schedules are disabled, what historical VestingWallets do, and how an authenticated vested-token release works.',
    badge: 'Vesting',
    badgeColor: '#06b6d4',
    readTime: '7 min read',
    category: 'dApp Guides',
    heroGradient: 'linear-gradient(135deg, #001a1e 0%, #002a33 50%, #001a1e 100%)',
    heroAccent: '#06b6d4',
    sections: [
      {
        type: 'text',
        heading: 'What a vesting schedule proves — and what it does not',
        body: 'A vesting wallet can restrict when its token balance becomes releasable under its coded schedule. It does not prove token value, project legitimacy, recipient behavior, fair distribution, or future price.\n\nThe legacy Lester factory is compromised and new schedule creation, deployment fees, and token approvals to it are disabled. Existing children remain separate contracts. Their schedule has no factory-owner clawback, but the VestingWallet owner can transfer ownership, so the eventual recipient is not necessarily immutable.',
      },
      {
        type: 'callout',
        callout: {
          type: 'warning',
          text: 'The vesting schedule cannot be cancelled or clawed back, but the initial beneficiary is the VestingWallet owner and can transfer ownership. Choose the initial owner and schedule carefully.',
        },
      },
      {
        type: 'text',
        heading: 'Key vesting concepts',
        body: 'Before setting up vesting, understand the two parameters that matter most:\n\nCliff: A period at the start where no tokens are released. If you set a 6-month cliff, beneficiaries receive nothing for the first 6 months, then all cliff tokens vest at once.\n\nLinear release: Tokens unlock continuously after the cliff. 12-month linear means 1/365th of the vested amount unlocks every day after the cliff ends.',
      },
      {
        type: 'step',
        heading: 'Releasing from an existing historical schedule',
        steps: [
          {
            title: 'Open a source-authenticated child',
            body: 'Navigate independently to lester-labs.com/vesting and select only a child discovered through a source-pinned legacy factory with a reviewed child-runtime hash.',
          },
          {
            title: 'Verify current ownership',
            body: 'Read the current VestingWallet owner rather than assuming the initial beneficiary still controls it. Confirm that the intended recipient controls that address.',
          },
          {
            title: 'Verify the token and schedule',
            body: 'Read the token address, current balance, released amount, start, cliff, duration, and `releasable(token)` value from the exact child. A copied interface or matching name is insufficient provenance.',
          },
          {
            title: 'Review the release call',
            body: 'The recovery transaction must be zero-value `release(token)` to the exact child wallet. Anyone may trigger it, but tokens go to the child’s current owner.',
          },
          {
            title: 'Release and verify',
            body: 'Sign only after every target and parameter check succeeds, then verify the token transfer and updated released amount through an independently selected RPC or explorer. Do not approve or deposit new tokens into the legacy factory.',
          },
        ],
      },
      {
        type: 'callout',
        callout: {
          type: 'tip',
          text: 'A visible schedule is only one data point. Verify current ownership, token controls, all material allocations, and the exact runtime; do not treat vesting as an endorsement or safety certificate.',
        },
      },
      {
        type: 'text',
        heading: 'How vested tokens are released',
        body: 'The source-reviewed historical child follows the OpenZeppelin VestingWallet release model: anyone may trigger `release(token)`, and the releasable amount is sent to the child’s current owner. The frontend exposes this only as an authenticated recovery path. Replacement schedule creation may resume only after distinct controller, treasury, and deployer roles plus exact factory/child runtime attestation are source-pinned.',
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
        body: 'LiteForge (chain ID 4441) is LitVM’s current test environment. It uses an EVM-compatible Arbitrum Orbit execution stack, but LitVM documents important EVM differences and a phased mainnet/settlement roadmap. Testnet behaviour, addresses, contracts, fees, bridges, and availability must not be treated as future-mainnet guarantees.\n\nLester Labs is in post-compromise containment. Read-only discovery and narrowly authenticated legacy recovery paths remain available; ordinary writes stay disabled until a newly deployed stack, exact runtimes, and clean served build are independently verified.',
      },
      {
        type: 'callout',
        callout: {
          type: 'info',
          text: 'LiteForge uses zkLTC as gas. Obtain test gas only from the faucet linked by LitVM’s official testnet hub. Lester Labs does not sell it, promise its availability, or represent that testnet zkLTC can be redeemed for mainnet assets.',
        },
      },
      {
        type: 'text',
        heading: 'Which wallet to use on LitVM testnet',
        body: 'Many EVM-compatible wallets may support LitVM LiteForge at the network level, but compatibility with this website is narrower: during recovery Lester exposes one injected-wallet connector and does not offer WalletConnect, Coinbase SDK, or other remote connectors. Use a disposable testnet-only injected wallet and verify its own LiteForge network settings. Never type a hardware-wallet seed phrase or private key into a software wallet, website, message, or support form.\n\nFor development workflows, verify the current official LiteForge parameters before configuring `wagmi`, `viem`, Hardhat, or Foundry. Network-level compatibility does not establish that a particular wallet integration has been reviewed by Lester Labs.',
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
            body: 'Cross-check the current values at LitVM’s official testnet hub:\n\nNetwork name: LitVM LiteForge\nNew RPC URL: https://liteforge.rpc.caldera.xyz/http\nChain ID: 4441\nCurrency symbol: zkLTC\nBlock explorer URL: https://liteforge.explorer.caldera.xyz\n\nCancel if the wallet prompt differs.',
          },
          {
            title: 'Save and switch',
            body: 'Click Save, then select \"LitVM LiteForge\" if MetaMask does not switch. Re-open the network details and verify chain ID 4441, the official RPC, and the official explorer before connecting Lester Labs.',
          },
        ],
      },
      {
        type: 'callout',
        callout: {
          type: 'warning',
          text: 'Chain ID 4441 is necessary but not sufficient: a wallet can be configured with an untrusted RPC for the same ID. Cross-check the RPC and explorer against LitVM’s official LiteForge parameters, inspect every wallet prompt, and remember that Lester’s source-pinned read endpoint may not be the provider your wallet uses.',
        },
      },
      {
        type: 'text',
        heading: 'Getting test zkLTC on LitVM',
        body: 'Open LitVM’s independently located official testnet hub and follow its current faucet link. Supply only a disposable wallet’s public address. Faucet limits and availability can change, and every on-chain action still consumes testnet gas.\n\nDo not buy testnet zkLTC, send LTC to a purported faucet operator, or repeat transactions to manufacture activity. Lester Labs ordinary write features remain disabled during the post-compromise cutover.',
      },
      {
        type: 'step',
        heading: 'Your first interaction with LitVM DeFi',
        steps: [
          {
            title: 'Review the current safety status',
            body: 'Read the incident and deployment status shown in the application. Do not bypass a disabled write or reuse a retired contract address.',
          },
          {
            title: 'Inspect without signing',
            body: 'Use read-only explorer and portfolio views to inspect testnet data. A swap or approval must remain blocked until the replacement DEX is deployed and source-pinned.',
          },
          {
            title: 'Use recovery paths only when applicable',
            body: 'If you already have a legacy vesting, lock, ILO, or LP position, use only the narrowly labelled recovery action after checking the exact target and decoded calldata.',
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
        body: 'Testnet is an experimental environment and must not be treated as evidence that any mainnet deployment, address, runtime, parameter, fee, or interface will be identical. Lester Labs is currently replacing its testnet contract set after a published security incident; write features remain fail-closed until each reviewed replacement and exact runtime hash is source-pinned.\n\nIf a future mainnet release is announced, verify it independently from reviewed source and published contract addresses. Never reuse a testnet assumption or approval with real-value assets.',
      },
    ],
    related: ['what-is-litvm', 'setting-up-litvm-wallet', 'how-to-use-dex-swap'],
  },

  // ── Article 12: LitVM reward-rumour safety ───────────────────────────────
  {
    slug: 'complete-guide-litvm-airdrop',
    title: 'LitVM Airdrop Rumours — Verify Before You Connect',
    subtitle: 'No LitVM reward programme, allocation, snapshot, or eligibility rules have been confirmed. Learn how to distinguish Lester Labs’ batch-distribution utility from third-party reward claims.',
    badge: 'Safety',
    badgeColor: '#fb923c',
    readTime: '4 min read',
    category: 'Ecosystem',
    heroGradient: 'linear-gradient(135deg, #1a0f00 0%, #2e1a00 50%, #1a0f00 100%)',
    heroAccent: '#fb923c',
    sections: [
      {
        type: 'callout',
        callout: {
          type: 'warning',
          text: 'Lester Labs has no authority to announce or verify a LitVM token reward. It does not promise rewards for transactions, track eligibility, operate a claim page, or ask for a seed phrase or private key. Treat posts claiming a confirmed allocation, snapshot, deadline, or guaranteed eligibility as unverified.',
        },
      },
      {
        type: 'text',
        heading: 'The “Airdrop Tool” is a distribution utility, not a reward claim',
        body: 'Lester Labs uses the common word “airdrop” for a batch-send tool. A sender can validate a token, recipient addresses, and exact amounts locally; a future source-pinned replacement is intended to perform those transfers only after activation. Until then, do not approve a distribution transaction. Using the utility does not enrol a wallet in any reward programme and does not prove eligibility for anything.\n\nThe tool has no seed-phrase form, credential recovery flow, hidden reward claim, or authority to distribute a LitVM protocol token. After a replacement is activated, every requested approval and transaction must still identify the source-pinned contract, chain, token, recipients, and amount before signing.',
      },
      {
        type: 'step',
        heading: 'Warning signs in third-party promotions',
        steps: [
          {
            title: 'Promises of a confirmed reward',
            body: 'Do not rely on posts that call a LitVM reward “confirmed,” quote an allocation percentage, imply Litecoin endorsement, or claim ordinary transactions guarantee eligibility unless an independently verified LitVM source publishes the exact programme.',
          },
          {
            title: 'Urgency or activity farming',
            body: 'Instructions to repeat transactions, create fresh wallets, manufacture volume, or interact “before the window closes” are not Lester Labs guidance. They can waste gas and are commonly used to push users into unsafe wallet prompts.',
          },
          {
            title: 'Credential or opaque signature requests',
            body: 'Close any page that asks for a seed phrase, private key, wallet password, remote-screen access, an unexplained signature, or an unlimited token approval. Lester Labs never needs wallet credentials.',
          },
        ],
      },
      {
        type: 'step',
        heading: 'How to verify a legitimate Lester Labs interaction',
        steps: [
          {
            title: 'Navigate independently',
            body: 'Type https://www.lester-labs.com yourself or use a saved bookmark. Avoid lookalike domains and links embedded in unsolicited posts, direct messages, advertisements, or search ads.',
          },
          {
            title: 'Check maintenance and contract status',
            body: 'The application fails closed when a reviewed replacement contract is not active or its runtime code does not match the source-pinned hash. Do not bypass a maintenance, provenance, wrong-network, retired-contract, or malicious-site warning.',
          },
          {
            title: 'Decode before signing',
            body: 'Confirm LitVM testnet chain ID 4441, the target contract, function, native value, token spender, allowance, and every recipient. Use a disposable test-only wallet and never keep valuable approvals or real assets in it.',
          },
        ],
      },
      {
        type: 'text',
        heading: 'Third-party posts are not Lester Labs endorsements',
        body: 'Anyone can publish a social post, tutorial, referral thread, or campaign that links to a public website. Lester Labs does not control those posts and does not endorse claims that testnet activity earns a future token. If you find a misleading promotion, preserve its URL and screenshot, report it to the platform, and verify any protocol announcement through independently located LitVM channels.',
      },
      {
        type: 'callout',
        callout: {
          type: 'tip',
          text: 'A real security warning is a reason to stop, not a hurdle to click through. No testnet task or hypothetical reward is worth exposing a valuable wallet.',
        },
      },
    ],
    related: ['airdrop-tool-guide', 'complete-guide-litvm-testnet', 'setting-up-litvm-wallet'],
  },

  // ── Article 13: LitVM Block Explorer ────────────────────────────────────
  {
    slug: 'litvm-block-explorer',
    title: 'LitVM RPC Explorer — Exact Lookups and Bounded Samples',
    subtitle: 'How to look up exact blocks and transactions, understand bounded recent address/token samples, and avoid mistaking Lester Labs for a full-history indexer.',
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
        body: 'The Lester Labs explorer is a lightweight LitVM RPC client, not a full-history indexing service. It can look up an exact transaction hash or block number and display bounded recent samples for feeds, addresses, factory tokens, and transfers. A bounded sample can omit older activity and must not be used to prove that no other transaction, token, or holder exists.\n\nConfirmed transactions are chain records, but their long-term availability through this website or any particular public RPC is not guaranteed. When completeness matters, compare an independently selected archival data source and preserve exact hashes and receipts.',
      },
      {
        type: 'callout',
        callout: {
          type: 'info',
          text: 'You do not need to connect a wallet to use read-only lookups. Exact lookups still depend on the configured RPC retaining and returning the requested data.',
        },
      },
      {
        type: 'text',
        heading: 'How to search on the LitVM block explorer',
        body: 'The search accepts Ethereum-format addresses, transaction hashes, and block numbers. Exact transaction and block routes request those objects directly. Address pages scan only the documented recent block window, so they do not show a full history.',
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
            body: 'The page shows the current native balance and statistics derived from its recent scan. “First seen,” transaction counts, and counterparties refer only to that bounded sample. Contract-code presence is a current RPC observation, not verified source.',
          },
          {
            title: 'Review the transaction history',
            body: 'The transaction table shows matching transactions found in the newest 200-block scan, capped by the page logic. Older or otherwise unreturned activity is omitted. Open the exact hash for direct transaction fields.',
          },
          {
            title: 'Check token holdings',
            body: 'The token table discovers Transfer logs in a bounded 10,000-block window and then reads balances for those discovered contracts. It can miss older holdings and is not a complete portfolio index.',
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
            body: 'A method label is a best-effort decode against a known ABI. Verify the target, raw input, emitted logs, value, state changes, and receipt; a selector label alone does not prove what an unknown contract did.',
          },
          {
            title: 'Verify token transfers',
            body: 'Any decoded transfer section reflects logs returned and understood by the page. Compare raw receipt logs when completeness matters, because internal calls and nonstandard token behavior may not be represented.',
          },
        ],
      },
      {
        type: 'step',
        heading: 'Exploring blocks',
        steps: [
          {
            title: 'Navigate to the block explorer',
            body: 'Go to lester-labs.com/explorer/block/[number] or click a block number. The page requests that exact block and the transactions returned by the RPC.',
          },
          {
            title: 'Read block metadata',
            body: 'Each block shows its number, timestamp, gas used, gas limit, transaction count, and the miner or validator address. Gas used vs limit tells you how full the block was.',
          },
          {
            title: 'Monitor chain health',
            body: 'The health view is a point-in-time RPC sample. It does not measure uptime, decentralization, historical liveness, finality, sequencer safety, or end-to-end network health.',
          },
        ],
      },
      {
        type: 'step',
        heading: 'Tracking tokens on LitVM',
        steps: [
          {
            title: 'Find a token contract',
            body: 'Search by exact token address. Metadata and total supply are current contract reads; deployer/factory provenance is asserted only when a matching source-pinned factory event is found in the bounded scan.',
          },
          {
            title: 'Review sampled inbound recipients',
            body: 'The distribution view ranks inbound Transfer volume among logs in a bounded 10,000-block sample, capped by its log limit. It is not a current holder-balance reconstruction and cannot prove supply distribution.',
          },
          {
            title: 'Find token transfers',
            body: 'The transfer list is a capped recent sample. It does not show every transfer and cannot independently audit a complete distribution. Use an archival index or source-pinned event range when completeness is required.',
          },
        ],
      },
      {
        type: 'text',
        heading: 'Verifying your own LitVM activity',
        body: 'During containment, ordinary Lester Labs writes are disabled. For an eligible recovery transaction, preserve the exact hash and verify its target, calldata, value, status, logs, and state change using more than one independently selected data source where practical.\n\nThe Lester Labs explorer is a convenience interface to RPC data. It does not provide a completeness, archival-retention, contract-safety, or identity guarantee.',
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

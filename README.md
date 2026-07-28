# Lester Labs

Lester Labs is a LitVM-native DeFi platform that bundles token deployment, launchpad liquidity seeding, swapping, LP visibility, governance, analytics, and utility tooling into a single surface.

This repository contains two main workspaces:

- `src/` and the project root: the Next.js App Router frontend
- `contracts/`: the Hardhat contracts, deploy scripts, and tests

## LitVM Testnet

| Parameter | Value |
|---|---|
| Network | LitVM Testnet (Liteforge) |
| Chain ID | `4441` |
| RPC URL | `https://liteforge.rpc.caldera.xyz/infra-partner-http` |
| Explorer | `https://liteforge.caldera.xyz` |
| Native Asset | `zkLTC` |
| Approved treasury target | `0xCbf819017ae48F261Fe143B2a7c8a29d9a2FCD28` |

Repository configuration names the approved target; it does not prove the live
rotation has executed. Treat the on-chain move as complete only after
`npm run verify:treasury:litvm` passes.

## Platform Surface

- `/launch` for ERC-20 deployment
- `/locker` for LP locking
- `/vesting` for vesting wallets
- `/airdrop` for batch distributions
- `/launchpad` for ILO creation and contribution
- `/swap` for Lester Labs Uniswap V2 swaps
- `/pool` for LP position discovery
- `/governance`, `/analytics`, `/portfolio`, `/ledger`, and `/explorer` for broader platform tooling

## Getting Started

Install frontend dependencies:

```bash
npm install
```

Install contract dependencies:

```bash
cd contracts
npm install
```

Run the frontend locally from the repo root:

```bash
npm install
npm run dev
```

Run contract compile and tests:

```bash
cd contracts
npm run compile
npm test
```

## Environment

Frontend contract addresses are read from environment variables. Copy `.env.local.example` to `.env.local` and populate the LitVM addresses you want the UI to target.

Important DEX-related variables:

```env
NEXT_PUBLIC_LITVM_RPC_URL=https://liteforge.rpc.caldera.xyz/infra-partner-http
NEXT_PUBLIC_UNISWAP_V2_FACTORY_ADDRESS=
NEXT_PUBLIC_UNISWAP_V2_ROUTER_ADDRESS=
NEXT_PUBLIC_WRAPPED_ZKLTC_ADDRESS=
NEXT_PUBLIC_ILO_FACTORY_ADDRESS=
NEXT_PUBLIC_LIQUIDITY_LOCKER_ADDRESS=
NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS=
```

## Deployment Flow

Deploy the Lester Labs Uniswap V2 stack first:

```bash
cd contracts
npm run deploy:uniswap:litvm
```

Then deploy or redeploy the broader Lester Labs contracts against that router:

```bash
cd contracts
npm run deploy:litvm
```

The deploy scripts are written to:

- require the approved Lester treasury controller on chain `4441`
- verify `feeTo` and `feeToSetter` both equal `0xCbf819017ae48F261Fe143B2a7c8a29d9a2FCD28`
- persist merged output to `contracts/deployed-addresses.json`

## DEX and Launchpad Notes

The local DEX lives under `contracts/contracts/uniswap/` and is based on Uniswap V2 core and periphery with Lester Labs-specific treasury routing:

- total fee per trade: `0.30%`
- treasury fee: `0.20%`
- LP fee retained in-pool: `0.10%`

`contracts/contracts/UniSwapConnector.sol` bridges Launchpad finalization into the Lester Labs router. It refuses to add liquidity unless the factory still points `feeTo` and `feeToSetter` at the Lester treasury.

The currently deployed ILO factory and connector are legacy recovery surfaces:
new ILO creation, legacy ILO funding, and legacy finalization are disabled in
the frontend. A separately reviewed future factory must be explicitly pinned
in source before creation can be re-enabled. Swap, pool, token, vesting,
locker, and Ledger paid writes independently re-read their live owner/treasury
or DEX fee controls before submission.

## Documentation

- App docs live in `src/content/docs/`
- Tutorials live in `src/lib/tutorials-content.ts`
- Product and implementation notes live in `docs/`

## Known Limitation

### Disperse.sol and Native-Asset Recipients

The `Disperse.sol` contract uses `.transfer()` for ETH sends, which enforces a 2300 gas stipend.
This is intentional as it provides implicit reentrancy protection inherited from the original banteg deployment.

**Limitation:** Contract wallet recipients (e.g. Gnosis Safe, smart contract addresses) that require
>2300 gas in their fallback function will cause the entire ETH disperse transaction to revert.

**Recommendation:** Only use the ETH airdrop feature to send to EOA (Externally Owned Account) wallets —
standard MetaMask, WalletConnect, or hardware wallet addresses. Do not attempt to disperse ETH directly
to multisig contracts or smart contract addresses.

Token (ERC-20) dispersal is not affected by this limitation.

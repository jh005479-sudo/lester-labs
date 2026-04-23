# Lester-Labs Contracts

Solidity smart contracts for the Lester-Labs DeFi toolkit, built with Hardhat + OpenZeppelin.

## Contracts

| Contract | Description |
|---|---|
| `TokenFactory` | Deploy ERC-20 tokens with configurable mint/burn/pause. Fee: 0.05 ETH |
| `LiquidityLocker` | Time-lock LP tokens with a withdrawer address. Fee: 0.03 ETH |
| `VestingFactory` | Create linear/cliff vesting schedules via OpenZeppelin VestingWallet. Fee: 0.03 ETH |
| `Disperse` | Bulk-send ETH or ERC-20 tokens to multiple recipients |

---

## Prerequisites

- **Node.js** v18+ (v22 recommended)
- A funded wallet with **Arbitrum Sepolia ETH** for gas
  - Faucet: https://www.alchemy.com/faucets/arbitrum-sepolia
- (Optional) A funded wallet with **LitVM** native token for LitVM deployment

---

## Setup

```bash
# 1. From the repo root, enter the contracts directory
cd contracts

# 2. Install dependencies
npm install

# 3. Copy the env example and fill in your private key
cp .env.example .env
# Edit .env — set DEPLOYER_PRIVATE_KEY to your 0x-prefixed wallet private key
```

> ⚠️ Never commit your `.env` file. It is in `.gitignore`.

---

## Compile

```bash
npx hardhat compile
```

---

## Deploy

### Arbitrum Sepolia (testnet)

```bash
npx hardhat run scripts/deploy.ts --network arbitrumSepolia
```

### LitVM mainnet

```bash
npx hardhat run scripts/deploy.ts --network litvm
```

After a successful deploy, a `deployed-addresses.json` file is written to the `contracts/` directory.

---

## After Deploying

Copy the contract addresses from `deployed-addresses.json` into the frontend:

```
src/lib/contracts/addresses.ts   ← update the address constants here
```

Example `addresses.ts` shape:
```typescript
export const CONTRACT_ADDRESSES = {
  TokenFactory:    "0x...",
  LiquidityLocker: "0x...",
  VestingFactory:  "0x...",
  Disperse:        "0x...",
} as const;
```

---

## Run Tests

```bash
npx hardhat test
```

---

## Notes

- `LiquidityLocker` has `withdrawFees()` (owner) distinct from `withdraw(lockId)` (user) to avoid ABI ambiguity.
- `VestingFactory` uses OpenZeppelin's `VestingWallet` — vesting schedules are non-revocable by design.
- `Disperse` is a minimal port of [disperse.app](https://disperse.app) (credit: banteg).

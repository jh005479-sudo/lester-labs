# Swap Feature — SPEC

> Status: DRAFT — do not build until V2 DEX confirmed on testnet

---

## 1. Concept & Vision

An embedded swap interface within the Lester Labs dapps menu. Users can swap any listed token directly on-platform without leaving the ecosystem. The primary value proposition is **convenience and platform cohesion** — not price competition. Revenue comes from a protocol fee baked into every swap.

The feel is professional and minimal: a focused tool, not a DeFi casino. Dark theme, monospace for amounts, clean token selection, no noise.

---

## 2. Fee Structure

| Parameter | Launch Week | Standard |
|---|---|---|
| Protocol fee | **0.20%** | **0.08%** |
| LP earns | 0.15% | 0.17% |
| **Total** | **0.35%** | **0.25%** |

- Fees configurable via env var (`NEXT_PUBLIC_SWAP_PROTOCOL_FEE_BPS`)
- Price displayed to user includes fee transparently
- Protocol fee accrued to a treasury address controlled by LDA

---

## 3. Architecture

### 3a. DEX Router Integration (Config-Driven)

The router address is injected via environment variable — **not hardcoded**. This allows:
- Testnet: point to local V2 fork deployment
- Mainnet: swap to LitVM's Algebra/V3 deployment with zero code changes

```
NEXT_PUBLIC_SWAP_ROUTER_ADDRESS=0x...  (V2 fork for testnet; Algebra router for mainnet)
NEXT_PUBLIC_SWAP_FACTORY_ADDRESS=0x... (for pool discovery)
NEXT_PUBLIC_SWAP_WETH_ADDRESS=0x...     (native token wrapper)
```

### 3b. DEX Interface Abstraction

Support both V2 and Algebra router interfaces via an abstraction layer:

```typescript
interface DexRouter {
  // Compute output amount + price impact
  getAmountsOut(amountIn: bigint, path: `0x${string}`[]): Promise<AmountsOut>
  // Build swap calldata
  buildSwap(params: SwapParams): Promise<TransactionRequest>
}
```

Two implementations initially:
- `V2DexRouter` — UniswapV2-style (for testnet V2 fork)
- `AlgebraDexRouter` — Algebra router (for mainnet, once confirmed)

### 3c. Supported Tokens

- Token list pulled from the **TokenFactory** event log (same source as portfolio)
- Pre-populated list with token name, symbol, logo (via `token-logo.ink` or similar)
- User can search by name, symbol, or paste address
- zkLTC (native) always available as input/output
- Recently-used tokens stored in `localStorage`

---

## 4. UI Layout — `/dapps/swap`

### 4a. Page Structure

```
[Navbar]
[Swap Header]
  Title: "Swap" | Network badge
  Settings gear (slippage tolerance)

[Swap Card]
  [Token In]
    Token selector button → Token picker modal
    Input field (large, monospace)
    USD equivalent below
    Balance + "MAX" button

  [Swap Direction Arrow] — click to flip

  [Token Out]
    Token selector button → Token picker modal
    Input field (large, monospace, READ-ONLY — computed)
    USD equivalent below

[Price + Route Info Row]
  Rate: 1 ETH = X TOKEN
  Price impact: X.XX%
  Route: TOKEN → zkLTC (direct) or multi-hop shown
  Fee: included in rate

[Swap Button]
  State: Connect Wallet → Select Token → Enter Amount → Swap
  On click: wallet confirmation → pending state → success/fail

[Transaction History] (below card)
  Recent swaps from this wallet — timestamp, pair, amount, status
```

### 4b. Token Picker Modal

- Search bar (name/symbol/address)
- Token list from TokenFactory events (name, symbol, balance)
- Tab: All | Recent | zkLTC
- "Manage tokens" link to localStorage token list
- Import custom token (address input + logo fetch)

### 4c. Settings Popover

- Slippage tolerance: 0.1% / 0.5% / 1.0% / Custom
- Transaction deadline: minutes (default 20)
- Expert mode toggle (skip confirmation for large trades)

---

## 5. Swap Flow

### 5a. Input → Output Computation

```
User selects token in, token out, enters amount
  → query router.getAmountsOut(amountIn, [tokenIn, tokenOut])
  → display output amount + price impact + route
  → if price impact > 5%: show warning
  → if output < dust threshold: disable swap
```

### 5b. Price Impact Tiers

| Price Impact | Display |
|---|---|
| < 1% | Green, normal |
| 1–5% | Yellow, caution |
| > 5% | Red, blocked by default (user must enable expert mode) |

### 5c. Transaction Submission

```
User clicks Swap
  → Build transaction (exact input OR exact output)
  → If token != zkLTC: check allowance, prompt approval if needed
  → Submit via wagmi useWriteContract
  → Wait for receipt
  → Show success: link to explorer tx
  → Update balances immediately (optimistic)
  → Add to transaction history
```

---

## 6. Components

| Component | Purpose |
|---|---|
| `SwapCard` | Main container — token selectors, input fields, swap arrow |
| `TokenSelector` | Button that opens TokenPickerModal |
| `TokenPickerModal` | Full token list with search |
| `SwapButton` | State machine: disabled → approve → confirm → pending → done |
| `PriceInfoRow` | Rate, price impact, route, fee breakdown |
| `SwapSettings` | Slippage + deadline popover |
| `SwapHistory` | Recent wallet swaps (localStorage + indexed events) |
| `useSwapQuote` | Hook: compute output amount from router |
| `useSwap` | Hook: build + submit swap transaction |
| `useTokenBalance` | Hook: ERC20 + native balance for any token |
| `useTokenAllowance` | Hook: check spender allowance |
| `useApproval` | Hook: submit approval transaction |

---

## 7. Contract Integration

### V2 Fork (Testnet)

Uses standard UniswapV2Router02 interface:
- `swapExactETHForTokens` / `swapExactTokensForETH` / `swapExactTokensForTokens`
- `getAmountsOut` for price discovery
- Factory: `getPair` for direct pair detection

### Algebra (Mainnet)

Uses AlgebraRouter interface once LitVM confirms deployment:
- `swap` function with `SwapParams` struct
- `quote` for price discovery
- Factory events for pool discovery

**ABIs:**
```typescript
// Stored in src/config/abis.ts
V2_ROUTER_ABI    = [...] // UniswapV2Router02
ALGEBRA_ROUTER_ABI = [...] // AlgebraRouter
```

---

## 8. Environment Variables

```env
NEXT_PUBLIC_SWAP_ROUTER_ADDRESS=   # V2 fork on testnet; Algebra on mainnet
NEXT_PUBLIC_SWAP_FACTORY_ADDRESS=  # For pair/pool discovery
NEXT_PUBLIC_SWAP_WETH_ADDRESS=    # Native token wrapper
NEXT_PUBLIC_SWAP_PROTOCOL_FEE_BPS= # e.g. "20" = 0.20%
NEXT_PUBLIC_SWAP_TREASURY_ADDRESS= # Where protocol fees accrue
```

---

## 9. Out of Scope (Phase 1)

- Multi-hop routing (phase 2: "Best Route")
- Limit orders
- Liquidity provision UI (separate page)
- Analytics dashboard for swap volume
- Token logos (Phase 1: text-only token list)

---

## 10. Dependencies Before Build

1. V2 DEX deployed on testnet (provides router + factory addresses)
2. LitVM confirms Algebra router ABI + address for mainnet
3. WETH or equivalent native token wrapper deployed on LitVM
4. `NEXT_PUBLIC_SWAP_*` env vars configured in Vercel

---

## 11. Files to Create/Modify

**New files:**
```
src/app/dapps/swap/page.tsx              — Swap page
src/components/swap/SwapCard.tsx
src/components/swap/TokenSelector.tsx
src/components/swap/TokenPickerModal.tsx
src/components/swap/PriceInfoRow.tsx
src/components/swap/SwapButton.tsx
src/components/swap/SwapSettings.tsx
src/components/swap/SwapHistory.tsx
src/hooks/useSwapQuote.ts
src/hooks/useSwap.ts
src/hooks/useTokenBalance.ts
src/hooks/useTokenAllowance.ts
src/lib/dex/abstraction.ts              — DexRouter interface
src/lib/dex/v2.ts                     — V2 implementation
src/lib/dex/algebra.ts                — Algebra implementation (mainnet)
src/config/abis.ts                     — Add V2/Algebra ABIs
docs/SWAP-FEATURE-SPEC.md             — This file
```

**Modified files:**
```
src/components/layout/Navbar.tsx        — Add Swap to dapps menu
src/app/dapps/page.tsx                 — Add Swap card
src/config/contracts.ts                — Add SWAP_ROUTER, SWAP_FACTORY, SWAP_WETH
.env.local                            — Add swap env vars
```

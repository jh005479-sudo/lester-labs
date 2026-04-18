# Governance Platform — Spec

## Overview

Self-contained on-chain governance for LitVM. No Snapshot, no IPFS requirement — proposals and votes live entirely on the LitVM chain.

---

## Architecture

### Contracts

**1. `LitGovToken` — Governance Token**
- ERC20 + ERC20Votes (OpenZeppelin)
- Mintable by owner (LDA treasury)
- `delegate(address)` — delegate voting power
- `delegateBySig(...)` — offline delegation (EIP-712)
- Total supply: 100M (18 decimals)
- Owner can mint batches for distribution

**2. `LitGovernor` — Governor Contract** (OpenZeppelin Governor + Timelock)
- Uses LitGovToken for voting weight
- Proposal lifecycle: Pending → Active → Succeeded → Queued → Executed → Expired
- Configurable: voting delay (1 block), voting period (7 days), quorum (4%), proposal threshold
- `propose(targets[], values[], calldatas[], description)` — standard OZ
- `castVote(proposalId, support)` — For / Against / Abstain
- `castVoteWithReason(proposalId, support, reason)` — with reason
- `execute(targets[], values[], calldatas[], descriptionHash)` — after succeeded
- `cancel(proposalId)` — by proposer or admin

**3. `LitTimelock` — Timelock Controller**
- Delay: 2 days (configurable)
- After a proposal succeeds, it sits in timelock for 2 days before execution
- Provides安全保障 against flash loan / governance attacks

### Deployment (LitVM testnet, chain ID 4441)

| Contract | Address |
|----------|---------|
| LitGovToken | TBD — deployer mints |
| LitTimelock | TBD |
| LitGovernor | TBD |

Governor is configured with:
- `votingDelay`: 1 block
- `votingPeriod`: 7 days (on LitVM block time ~3s → ~518,400 blocks)
- `quorum`: 4% of total supply
- `proposalThreshold`: 100,000 tokens (0.1% of supply)

---

## Frontend

### Pages & Routing

| Route | Description |
|-------|-------------|
| `/governance` | Main governance page |
| `/governance/[proposalId]` | Individual proposal page (detail + vote) |

### Components

**`SpacesTab`** — list available governance spaces (from governor contract)
- Shows: space name, token, proposal count, your voting weight
- One space per deployment (expandable later)

**`ProposalList`** — fetches from governor via `queryFilter`
- States: Pending, Active, Defeated, Succeeded, Queued, Executed, Canceled
- Filter by state

**`ProposalDetail`** (new page `/governance/[proposalId]`)
- Title, description, proposer address
- Vote breakdown: For / Against / Abstain (live from `proposalVotes()`)
- Vote buttons (connected wallet)
- Vote power shown (from token balance + delegation)
- Execute button (after succeeded + timelock elapsed)

**`CreateProposalTab`**
- Title, body (markdown rendered on-chain as string)
- Actions: list of target addresses + calldata (basic)
- For testnet: simpler version — just text proposal, targets=[zero], calldatas=[], values=[0]
- Submit calls `governor.propose()`

**`VoteTab`**
- Load proposal by ID
- Show current vote tally
- Cast vote button (wallet connected required)
- Reason field (optional)

### Data Fetching

- Proposals: `governor.queryFilter governor.ProposalCreated` — paginated
- Proposal state: `governor.state(proposalId)` — live
- Vote tally: `governor.proposalVotes(proposalId)` — live
- User voting power: `token.getVotes(account)` — at current block
- User balance: `token.balanceOf(account)`
- Delegatee: `token.delegates(account)`

### ABI & Config

```typescript
// src/config/abis/governance.ts
export const GOV_TOKEN_ABI = [...]
export const GOV_GOVERNOR_ABI = [...]
export const GOV_TIMELOCK_ABI = [...]

// src/config/contracts.ts
NEXT_PUBLIC_GOV_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_GOVERNOR_ADDRESS=0x...
NEXT_PUBLIC_TIMELOCK_ADDRESS=0x...
```

---

## User Flow

1. User lands on `/governance` → sees Spaces tab → proposal list
2. Connect wallet → sees voting weight
3. Click Active proposal → `/governance/[id]` → reads proposal → votes
4. Create proposal tab → submits on-chain proposal
5. After voting period ends → proposer executes

---

## Vote Weight Logic

```
votingPower = token.balanceOf(account) + token.delegatedBalance(account)
             = token.getVotes(account) at current block
```

Users must delegate to themselves (or someone else) to have voting power. Self-delegation happens automatically on first token receive OR via explicit `delegate()` call.

---

## Testnet Bootstrap

- LDA deploys contracts
- LDA mints and distributes 10M tokens each to ~10 bootstrap wallets for testnet voting
- Tokens transferable — community can acquire and delegate

---

## Scope for v1 (testnet)

- ✅ One governance space (LitVM community)
- ✅ Create text proposals
- ✅ Vote (For / Against / Abstain)
- ✅ Execute after timelock
- ✅ Live from contract data
- ⬜ Multi-space (later)
- ⬜ EIP-712 offline delegation
- ⬜ Dynamic quorum curves

# The Ledger — Full Build Brief for Codex

> Build Lead: Cortana (Jack's AI)
> Project: Lester Labs dApp on LitVM
> Repo: `~/Projects/lester-labs`
> Branch: `feat/ledger` (create from `main`)
> Deploy target: Testnet first, then mainnet

---

## 1. Concept

**What:** A permanent, fee-gated on-chain message board. Users pay 0.01 zkLTC to post text (up to 500 characters) encoded directly in the transaction calldata. Messages are permanently etched in LitVM's blockchain history — readable via explorer or UI, immutable, censorship-resistant.

**What it's NOT:** A chat app. A forum. A messaging platform. A token-gated community.

**What it IS:** A social ledger — the community's permanent voice from day one of mainnet. Each message is an artifact of the chain's origin story.

**Tagline:** *Leave your mark on the blockchain.*

**Placement:** Standalone page — accessible from the dapps menu, NOT embedded in the launchpad. Not launchpad-specific. Anyone can post, regardless of token launch activity.

**Target users:**
- Early LitVM community members who want to be part of the origin story
- Token projects with community announcements
- General on-chain social layer participants

**Success metric:** Messages exist in The Ledger from day one of mainnet. People reference their ledger post as proof of early participation.

---

## 2. Location & Context

### Repository
```
~/Projects/lester-labs
```
Next.js + TypeScript + Wagmi + Viem stack.
Full context: `src/` contains all components, `src/lib/` contains utilities, `src/config/` contains ABIs and contract addresses.

### Relevant existing files (read before building)
```
src/app/launchpad/page.tsx          — Reference for page layout + wagmi integration
src/lib/rpcClient.ts                — RPC URL (already configured for LitVM)
src/config/abis.ts                  — Where to add TheLedger ABI
src/config/contracts.ts             — Where to add THE_LEDGER_ADDRESS env var
src/components/shared/ToolHero.tsx — Hero banner component used across pages
src/components/layout/Navbar.tsx    — Where to add "The Ledger" nav link
.env.local                          — Where to add THE_LEDGER_ADDRESS + IMGBB keys
docs/SWAP-FEATURE-SPEC.md           — Reference for how specs are documented here
```

### Smart contract standard
All contracts on this chain follow this pattern:
```solidity
// Events emitted with indexed fields for efficient filtering
event MessagePosted(address indexed sender, uint256 index, uint256 timestamp, bytes data)

// Write functions are payable — value is the fee
function post(bytes calldata message) external payable
```

### RPC endpoints (already configured in `src/lib/rpcClient.ts`)
```
HTTP:  https://liteforge.rpc.caldera.xyz/infra-partner-http
WebSocket: wss://liteforge.rpc.caldera.xyz/ws
```

### Chain info
- Chain ID: 4441 (LitVM Testnet)
- Block time: ~1 second
- Native token: zkLTC

---

## 3. Smart Contract — TheLedger.sol

### Specification

**Inheritance:** None. Standalone contract.

**State:**
```solidity
address public treasury;              // LDA treasury — receives 50% of fees
uint256 public MIN_FEE = 0.01 ether;  // 0.01 zkLTC — mutable, setMinFee() works (constant removed post-audit)
uint256 public treasuryCutBps = 5000; // 5000 bps = 50% to treasury, 50% burned/remainder
uint256 public messageCount;          // Increments each post
```

**Events:**
```solidity
event MessagePosted(
    address indexed sender,
    uint256 indexed index,
    uint256 timestamp,
    bytes data
);
```

**Write function (CEI pattern + nonReentrant):**
```solidity
function post(bytes calldata message) external payable nonReentrant {
    require(msg.value >= MIN_FEE, "Insufficient fee");
    require(message.length > 0, "Empty message");
    require(message.length <= 1024, "Message too long");

    // CEI: state updates before external call
    uint256 index = messageCount;
    messageCount++;

    emit MessagePosted(msg.sender, index, block.timestamp, message);

    // External call LAST
    uint256 treasuryAmount = (msg.value * treasuryCutBps) / 10000;
    if (treasuryAmount > 0) {
        (bool sent, ) = treasury.call{value: treasuryAmount}("");
        require(sent, "Transfer failed");
    }
}
```

**Admin functions (owner-only):**
```solidity
function setTreasury(address _treasury) external onlyOwner {
    require(_treasury != address(0), "Zero address");
    treasury = _treasury;
}

function setMinFee(uint256 _minFee) external onlyOwner {
    require(_minFee > 0, "Fee must be positive");
    require(_minFee <= 0.1 ether, "Fee too high"); // max 0.1 zkLTC (~$5 at current prices)
    MIN_FEE = _minFee;
}

/// @notice Rescue any ERC-20 tokens sent directly to the contract
function rescueERC20(address token, uint256 amount) external onlyOwner {
    IERC20(token).transfer(owner(), amount);
}

/// @notice Accept direct ETH transfers
receive() external payable {}
```

**Notes:**
- Emit event only — do NOT store message content in a mapping. Events ARE the data. This keeps gas low (~25-40k per post)
- Use OpenZeppelin `Ownable` for owner-only functions
- Deploy on testnet first, verify on explorer
- The `treasury` address should be a configurable constant set at deployment

**Gas estimate:** 25-40k gas per post for 500-char message

**Deploy:**
- Use Foundry (`forge create`) or Hardhat
- Verify on Liteforge Explorer after deployment
- Provide deployed address to frontend team

---

## 4. Fee Structure

| Parameter | Value |
|---|---|
| Per message fee | **0.01 zkLTC** |
| LDA treasury cut | **50%** → 0.005 LTC per message |
| Burn / remainder | **50%** → 0.005 LTC (no further action needed, just don't send it anywhere — it stays in the contract or gets re-emptively sent to address(0) burn) |

**Alternative burn implementation** (cleaner):
```solidity
uint256 burnAmount = msg.value - treasuryAmount;
// burn is implicit — don't send burnAmount anywhere, or send to 0x000000...
```
OR just let the remainder stay in the contract and add a `withdraw()` function for the owner to sweep occasionally. The treasury cut is the primary revenue mechanism.

---

## 5. Frontend — `/ledger` page

### Page structure

```
/ledger
├── Navbar (already present)
├── ToolHero ("The Ledger", tagline, stats)
├── MessageComposer (the "post" form)
│   ├── Text input (max 500 chars)
│   ├── Character counter
│   ├── Fee display ("Costs 0.01 zkLTC")
│   ├── Post button → wallet → tx
│   └── Status: idle / signing / pending / confirmed / error
├── MessageFeed (the real-time feed)
│   ├── WebSocket subscription to new MessagePosted events
│   ├── Polling fallback (every 30s) if WebSocket drops
│   └── Paginated historical load (batch of 50, load more on scroll)
└── Stats bar (total messages, total LTC burned, your posts)
```

### Components to create

| Component | Purpose | File |
|---|---|---|
| `TheLedger` page | Main page container | `src/app/ledger/page.tsx` |
| `MessageComposer` | Post form | `src/components/ledger/MessageComposer.tsx` |
| `MessageFeed` | Real-time + paginated feed | `src/components/ledger/MessageFeed.tsx` |
| `MessageCard` | Single message display | `src/components/ledger/MessageCard.tsx` |
| `LedgerStats` | Stats bar | `src/components/ledger/LedgerStats.tsx` |
| `useLedgerFeed` | WebSocket + polling hook | `src/hooks/useLedgerFeed.ts` |

### Layout guidance

**Hero:** Dark theme, accent color `#5E6AD2` or similar. Tagline: *"Leave your mark on the blockchain."* Show total message count and current LTC price if available.

**Message Composer:**
- Full-width text area, dark background, monospace font for the text
- Live character count: "N / 500"
- "Post to The Ledger — 0.01 zkLTC" button below
- States: empty (disabled button) → has text (button active) → signing → pending → confirmed → error
- On success: show tx hash link to explorer, clear input, prepend new message to feed

**Message Feed:**
- Newest-first, paginated (load 50 at a time, "Load more" at bottom)
- Each card: truncated sender address (0x1234...abcd), relative timestamp ("2s ago"), message text, "View tx →" link
- When WebSocket fires a new event: prepend to feed with a subtle highlight animation (border flash, then settle)
- Empty state: "Be the first to leave a mark on LitVM's history."

**Real-time feed implementation:**
```typescript
// useLedgerFeed hook pseudocode
function useLedgerFeed(contractAddress: `0x${string}`) {
  // 1. Load historical messages via eth_getLogs (paginated, 50 at a time)
  // 2. Subscribe to WebSocket: eth_subscribe('logs', { address: contractAddress, topics: [MessagePostedSig] })
  // 3. On new event: decode, prepend to feed
  // 4. On WebSocket disconnect: fall back to polling eth_getLogs every 30s
  // 5. Handle reconnect gracefully
}
```

### ABI to add

```typescript
export const LEDGER_ABI = [
  {
    name: 'post',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'message', type: 'bytes' }],
    outputs: [],
  },
  {
    name: 'messageCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'treasury',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'event',
    name: 'MessagePosted',
    inputs: [
      { name: 'sender', type: 'address', indexed: true },
      { name: 'index', type: 'uint256', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
      { name: 'data', type: 'bytes', indexed: false },
    ],
  },
] as const
```

### Environment variables to add

```env
NEXT_PUBLIC_LEDGER_ADDRESS=<deployed contract address>
```

---

## 6. Real-Time Feed Monitoring

### WebSocket setup
```typescript
const WS_URL = 'wss://liteforge.rpc.caldera.xyz/ws'
const LEDGER_ADDRESS = process.env.NEXT_PUBLIC_LEDGER_ADDRESS
const MESSAGE_POSTED_SIG = '0x...' // get from contract events once deployed
```

### Subscription logic
1. On mount: connect WebSocket
2. Send `eth_subscribe` for `logs` filtered by `address: LEDGER_ADDRESS` and `topics: [MESSAGE_POSTED_SIG]`
3. On message: parse, decode hex to UTF-8 string, prepend to feed
4. On disconnect: set 30s polling interval as fallback, reconnect WebSocket in background
5. On reconnect: cancel polling, resume WebSocket

### Decoding messages from event data
```typescript
// Message is bytes in event data — decode to string
const messageHex = event.data // '0x...' prefix
const messageBytes = Buffer.from(messageHex.slice(2), 'hex')
const messageText = messageBytes.toString('utf8').replace(/\0+$/, '')
// Note: 500 chars → ~500 bytes in UTF-8, which is ~1000 hex chars → 512 bytes of data field
```

### Historical loading (pagination)
```typescript
// Load N messages from the past
async function loadMessages(fromIndex: number, count: number) {
  // Use eth_getLogs with fromBlock: earliest and a topics filter for MessagePosted
  // Filter by index range (messageCount - count to messageCount)
  // Decode each event's data field
}
```

---

## 7. Testing Instructions

### Adversarial brief — test thoroughly before merging

When the build is complete, run the following tests and fix any issues found:

**Contract tests:**
- Post with exact fee — should succeed
- Post with less than MIN_FEE — should revert with "Insufficient fee"
- Post with empty bytes — should revert with "Empty message"
- Post with 1025 bytes — should revert with "Message too long"
- Post with exactly 1024 bytes — should succeed
- Two users post simultaneously — events should have correct distinct sender and incrementing index
- Treasury address set to zero address — should still work (funds go to zero address, effectively burned)

**Frontend tests:**
- Post with no wallet connected — should show "Connect Wallet" state
- Post with wallet connected but form empty — button should be disabled
- Post with text exceeding 500 chars — character counter should turn red, button disabled
- Message appears in feed after confirmation — within 5 seconds of tx confirm
- Reload page — existing messages load from historical log, WebSocket reconnects
- WebSocket disconnect — polling fallback activates without duplicating messages
- Rapid-fire posts (3 in a row) — messages appear in correct order, no duplicates
- Long message (500 chars) — renders correctly without overflow or truncation
- TX fails — error state shown, user can retry, no ghost message in feed

**UX/UI tests:**
- Mobile layout — composer and feed cards render correctly at 375px width
- Dark mode — all text visible, no white-on-white elements
- Loading state — feed shows skeleton cards while loading historical messages
- Empty state — "Be the first to leave a mark..." message shown when no posts exist

**Edge cases:**
- Browser tab hidden for 10 minutes, WebSocket drops — reconnect works, no duplicate messages in feed, missed messages loaded via polling
- User pastes a very long string (1000+ chars) — truncated at 500 chars in preview, submission blocked
- RPC rate-limited — show user-friendly error, allow retry
- Message contains only whitespace — should be rejected (empty after trim)
- Unicode/special characters — should encode/decode correctly (emoji, non-Latin, etc.)

---

## 8. GitHub Workflow

1. Create branch: `git checkout -b feat/ledger`
2. Build all components per this brief
3. Write and run tests per section 7
4. Fix all issues
5. Commit: `git add -A && git commit -m "feat(ledger): on-chain messaging contract + UI + real-time feed"`
6. Push: `git push -u origin feat/ledger`
7. Open PR against `main`, request review
8. After approval: merge to `main` → Vercel auto-deploys

**Important:** Do NOT merge without passing all adversarial tests in section 7. If issues are found, fix them first. The brief is the source of truth.

---

## 9. Files to create / modify

### New files
```
src/app/ledger/page.tsx                    — Page entry point
src/components/ledger/MessageComposer.tsx
src/components/ledger/MessageFeed.tsx
src/components/ledger/MessageCard.tsx
src/components/ledger/LedgerStats.tsx
src/hooks/useLedgerFeed.ts                  — WebSocket + polling hook
src/lib/contracts/ledger.ts               — ABI + constants
docs/LEDGER-SPEC.md                       — This document (save for future reference)
```

### Modified files
```
src/config/abis.ts                        — Add LEDGER_ABI
src/config/contracts.ts                   — Add LEDGER_ADDRESS
src/components/layout/Navbar.tsx          — Add "The Ledger" link
.env.local                                 — Add NEXT_PUBLIC_LEDGER_ADDRESS
```

---

## 10. Contract deployment (do this first)

Before frontend work begins, deploy the contract:

```bash
cd contracts
forge create src/TheLedger.sol:TheLedger --constructor-args <TREASURY_ADDRESS> --rpc-url https://liteforge.rpc.caldera.xyz/infra-partner-http --private-key <DEPLOYER_KEY>
```

Verify on: https://liteforge.caldera.xyz/

Provide the deployed address to the frontend team before UI build starts.

---

## 11. Out of scope for v1

- Image/file uploads
- Message editing or deletion
- Reply threads (flat list only)
- Reactions / upvotes
- Username/display name system (wallet address is identity)
- Search by content
- Filter by address (v1 is just chronological feed)
- Admin moderation (no messages are ever deleted)

---

*Brief compiled by Cortana — Jack's AI. For questions contact Jack directly.*
*Last updated: 2026-04-17*
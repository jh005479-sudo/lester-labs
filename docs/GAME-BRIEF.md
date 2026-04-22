# LITINVADERS — Product Brief for Codex

**Project:** LitInvaders — A Space Invaders-style arcade game with on-chain score posting to The Ledger
**For:** Jack Hartley, Lester Digital Assets / Lester Labs
**Date:** 2026-04-20
**Status:** BRIEF — NOT YET STARTED

---

## 1. Project Overview

### What are we building?
A browser-based, pixel-art Space Invaders clone skinned for the LitVM / crypto ecosystem. Players control a turret defending against waves of shitcoin-logo aliens. After each run, scores are permanently posted to The Ledger on LitVM — making high scores publicly verifiable, on-chain records of gaming achievement.

### Why this matters for Lester Labs
- Drives recurring fee revenue from Ledger posts (0.01 zkLTC per score submission)
- Creates daily active user engagement loop
- Builds on existing LitVM infrastructure with no new smart contracts required
- Differentiator: no Web2 arcade can offer on-chain, permanent, publicly verifiable high scores
- Low barrier to entry — Space Invaders mechanics are universally understood

### Context
This is a greenfield Next.js page within the existing Lester Labs monorepo. The game is a single self-contained page at `/arcade` (or `/game`). It uses the existing Lester Labs design system, RainbowKit wallet connection, and The Ledger smart contract already deployed on LitVM.

---

## 2. Technical Context

### Chain & Network
- **Chain:** LitVM Testnet (Chain ID: `4441`)
- **RPC:** `https://liteforge.rpc.caldera.xyz/infra-partner-http`
- **WebSocket:** `wss://liteforge.rpc.caldera.xyz/ws`
- **Explorer:** `https://lester-labs.com/explorer`
- **Native Currency:** zkLTC (testnet, no real value)

### Key Contracts (already deployed)

| Contract | Address | Purpose |
|---|---|---|
| TheLedger | `0xa37fF4bAb59A5F861B48527A946C433dc1Ee8079` | On-chain message board |
| LEDGER_ABI | See `src/config/abis.ts` | ABI for Ledger contract |
| MIN_FEE | 0.01 zkLTC | Minimum fee per post |

### Ledger Interface
```typescript
// Write (payable — costs 0.01 zkLTC)
ledger.post(bytes memory message)  // posts arbitrary bytes to chain

// Read
ledger.messageCount() returns uint256
ledger.MIN_FEE() returns uint256

// Events (used for leaderboard)
event MessagePosted(address indexed sender, uint256 indexed index, uint256 timestamp, bytes data)
```

### Tech Stack
- **Framework:** Next.js (App Router) — existing monorepo
- **Wallet:** RainbowKit + wagmi v2 + viem — already in use across Lester Labs
- **Styling:** Tailwind CSS + CSS modules — matching existing Lester Labs design system
- **Game Engine:** HTML5 Canvas (vanilla JS, no game engine dependency)
- **State:** React hooks (useState/useEffect/useRef)
- **Audio:** Web Audio API (optional, retro 8-bit sound effects)
- **Deployment:** Vercel (same pipeline as existing Lester Labs pages)

---

## 3. Game Specification — LitInvaders

### Visual Theme

**Player Turret (Lester):**
- Pixel art cannon/turret, approximately 13x8 pixels
- Colour: Magenta/pink gradient (#FF00FF to #FF69B4) — matching Lester Labs brand
- Three-frame animation: idle, firing, hit
- Replaces classic green cannon

**Aliens (Shitcoin Logos):**
- Five rows of 11 aliens = 55 enemies per wave
- Each row is a different "tier" of shitcoins:
  - Row 1 (top, squid sprites): BTC logo — 30 points each
  - Row 2: ETH logo — 25 points each
  - Row 3: SOL logo — 20 points each
  - Row 4: DOGE logo — 15 points each
  - Row 5 (bottom, crab sprites): PEPE/FLOKI logo — 10 points each
- Two-frame animation per alien type (classic Space Invaders wobble)
- Aliens march left-right, dropping down one row each time they hit the screen edge
- Aliens speed up as fewer remain

**Defensive Shields (zkLTC Coin Formations):**
- Four shield bunkers made of stacked zkLTC coin pixel sprites
- Each coin is ~3x3 pixels
- Shields erode when hit by alien bullets (pixel-by-pixel destruction matching classic)
- Classic layout: 4 shields evenly spaced

**Background:**
- Deep space black (#000000) with subtle star field
- Occasional pixel-art shooting star animation
- Scanline overlay (subtle CRT effect, CSS)

**Colour Palette:**
- Background: #000000
- Player: #FF00FF (Lester magenta)
- UI/Text: #FFFFFF and #00FF88 (neon green — LED display feel)
- Shields: #FFD700 (gold/zkLTC colour)
- Aliens: white with subtle green tint

**Score Display:**
- LED-style seven-segment display font
- Large, top-centre of screen
- Format: `SCORE: 00000`
- Lives display: 3 Lester turret sprites in bottom-left

**Game Over / Game Complete:**
- Pixel art text "GAME OVER" or "WAVE COMPLETE"
- Final score prominently displayed
- "POST SCORE TO LEDGER" button (prominent, magenta)
- Leaderboard preview (top 5 from Ledger)

### Game Mechanics

**Player Controls:**
- Arrow keys (left/right) to move turret
- Spacebar to fire
- Enter to start / restart
- P to pause
- Touch controls on mobile: left/right tap zones + central fire button

**Wave Structure:**
- Wave 1: Slow alien movement, 2 rows of aliens
- Progressive difficulty: each wave adds one more row, slightly faster alien speed
- Every 3 waves: brief "WAVE COMPLETE" interlude before next wave
- Endless — no win condition, play until all lives lost

**Collision Detection:**
- Player bullet vs alien: alien destroyed, score added, explosion sprite
- Alien bullet vs player: life lost, turret explosion animation, brief respawn invincibility
- Alien bullet vs shield: pixel erosion
- Player bullet vs shield: pixel erosion

**Scoring:**
- BTC aliens: 30 pts
- ETH aliens: 25 pts
- SOL aliens: 20 pts
- DOGE aliens: 15 pts
- PEPE/FLOKI aliens: 10 pts
- Bonus "mystery ship" (occasional, flies across top): 50-300 pts random

**Lives:**
- Start with 3 lives
- Lose a life when hit by alien bullet
- Game over at 0 lives

### Ledger Score Payload

After each game over, the player is prompted to post their score to The Ledger.

**Payload format (bytes encoding):**
```json
{
  "game": "litinvaders",
  "score": 12500,
  "wallet": "0xABC...123",
  "wave": 7,
  "timestamp": 1745155200,
  "version": 1
}
```

This JSON is serialised to bytes and posted via `ledger.post()`. The sender address is captured from `msg.sender` at contract level — wallet address is included in the payload for off-chain indexing convenience.

**Fee:** 0.01 zkLTC per post (paid by the caller)

**Flow:**
1. Game over screen appears
2. Player clicks "POST SCORE TO LEDGER"
3. RainbowKit wallet popup appears (if not connected)
4. Transaction submitted to LitVM via `writeContractAsync`
5. On confirmation: "Score posted!" confirmation with transaction hash
6. Score immediately appears on the on-chain leaderboard

---

## 4. Page Layout (Outside Game Canvas)

### URL: `/arcade` or `/game`

### Page Structure

```
┌─────────────────────────────────────────────────────┐
│  NAVBAR (existing Lester Labs navbar)               │
│  Logo | dApps ▾ | DEX ▾ | [Ledger] [Explorer]... │
├─────────────────────────────────────────────────────┤
│  HEADER                                             │
│  "LITINVADERS" — pixel art title                   │
│  "Shoot down the shitcoins. Post your score."       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │           GAME CANVAS (640 x 480)             │  │
│  │                                               │  │
│  │   [Aliens] [Bunkers] [Player] [Bullets]     │  │
│  │                                               │  │
│  │   SCORE: 00000    LIVES: ▲▲▲    WAVE: 1    │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  [HOW TO PLAY] [LEADERBOARD] [YOUR SCORES]         │
│                                                      │
├─────────────────────────────────────────────────────┤
│  FOOTER                                             │
│  Powered by LitVM · Lester Labs                     │
└─────────────────────────────────────────────────────┘
```

### Three Tabs Below the Canvas

**Tab 1: HOW TO PLAY**
- Control instructions (keyboard + touch)
- Alien identification guide (which logo = which points)
- Brief explanation of Ledger score posting
- "Scores are permanent and publicly verifiable on LitVM"

**Tab 2: LEADERBOARD**
- Fetches top 20 scores from The Ledger via `getEvents` (event filters on `MessagePosted` where `data` starts with `{"game":"litinvaders"`)
- Displays: Rank, Wallet address (truncated + copy button), Score, Wave reached, Date
- Refreshes every 30 seconds
- If wallet connected: highlights user's own scores

**Tab 3: YOUR SCORES**
- Only shown if wallet connected
- Fetches all Ledger posts from connected wallet with `game=litinvaders` payload
- Shows personal history: score, wave, date, tx hash
- "POST LAST SCORE" shortcut if not yet posted

### Responsive Behaviour
- Canvas scales to fit viewport width on mobile (max 640px wide)
- Touch controls appear below canvas on mobile
- Tabs stack vertically on small screens

---

## 5. Sprint Breakdown

### Sprint 1: Core Game Engine + Canvas Setup
**Duration:** 3-4 days
**Goal:** Fully playable Space Invaders clone with placeholder sprites (no crypto skinning yet)

**Deliverables:**
- Next.js page at `/arcade` with 640x480 canvas
- Player turret (placeholder square), moveable left/right with arrow keys
- Spacebar fires bullets
- 3 rows of placeholder aliens (coloured rectangles), marching left-right, dropping down
- Four placeholder shield bunkers
- Alien bullets firing at random intervals
- Collision detection (bullets vs aliens, bullets vs player, bullets vs shields)
- Score tracking, lives system, wave progression
- Game states: TITLE_SCREEN → PLAYING → GAME_OVER
- Pause functionality (P key)
- Basic game over screen

**Testing Gate:**
- Play 10 consecutive full games without any crash or visual glitch
- Collision detection accuracy: 0 false positives/negatives in 50 test runs
- Wave progression works correctly for waves 1-5
- Lives system resets correctly on game restart

**Audit Gate (Adversarial):**
- "Find any way to submit a score without playing the game" — should be impossible
- "Find any way to modify the score in-memory before post" — out of scope for front-end; note that front-end scores are game-state only, not authoritative
- "Can the game be paused mid-wave and resumed with aliens in wrong position" — should work correctly
- Check for any dead keys or unresponsive states in the control system

---

### Sprint 2: Pixel Art Assets + Full Visual Skinning
**Duration:** 2-3 days (depends on designer asset delivery)
**Goal:** All placeholder sprites replaced with final pixel art

**Deliverables:**
- Lester turret sprite (13x8 px, magenta, 3 animation frames)
- Five alien types with pixel art logos (BTC, ETH, SOL, DOGE, PEPE) — each 8x8 px, 2 animation frames
- zkLTC coin shield sprites (~3x3 px per coin, stacking)
- Explosion sprites (3 frames)
- Mystery ship sprite
- Background star field (CSS or canvas)
- Pixel-art title text "LITINVADERS"
- HUD styling (LED font, neon green/white)

**Testing Gate:**
- All sprites render at correct pixel scale (no blur, nearest-neighbour scaling)
- Animation frames cycle correctly
- Shield pixel erosion shows correctly (single-pixel destruction)
- No sprite flicker on canvas redraw

**Audit Gate (Adversarial):**
- "Are any sprites visually similar enough to confuse players about which alien is which" — check BTC row is clearly distinct from DOGE row
- "Check sprite loading — does game work if one sprite fails to load" — should use placeholder or fail gracefully

---

### Sprint 3: Wallet Integration + Ledger Score Posting
**Duration:** 2 days
**Goal:** Fully functional Ledger post flow after game over

**Deliverables:**
- RainbowKit Connect Wallet button (shown on game over screen if wallet not connected)
- "POST SCORE TO LEDGER" button after game over
- Payload construction: `{ game: "litinvaders", score, wallet, wave, timestamp, version: 1 }`
- Serialise to JSON → bytes via `TextEncoder`
- `writeContractAsync` call to `ledger.post(payload)`
- Transaction status modal (pending → confirmed → error)
- On success: show tx hash, offer to view on explorer
- On rejection: return to game over screen, allow retry
- Fee: 0.01 zkLTC — display clearly to user before they confirm

**Ledger ABI (from `src/config/abis.ts`):**
```typescript
const LEDGER_ABI = [
  {
    name: 'post',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'message', type: 'bytes' }],
    outputs: [],
  },
  // messageCount and MIN_FEE also available for UI display
]
```

**Testing Gate:**
- Post 5 scores to Ledger, verify all 5 appear in Ledger events
- Verify payload decodes correctly from on-chain data
- Verify fee deduction is exactly 0.01 zkLTC
- Test: wallet disconnected → "connect wallet" prompt → connect → continue to post
- Test: user rejects transaction → error message shown, game over screen remains
- Test: insufficient balance → clear error message before wallet popup

**Audit Gate (Adversarial):**
- "Can a user post a score without paying the fee" — fee must be in transaction value
- "Can a user post someone else's score by manipulating the payload" — wallet address comes from `msg.sender`, not from payload
- "Can the payload be truncated or malformed to cause on-chain parsing issues" — validate JSON structure before encoding
- "Is the score vulnerable to replay attacks (same score posted multiple times)" — this is by design; no prevention needed
- "Does the post work on wrong network" — must verify chain ID 4441 before posting

---

### Sprint 4: Leaderboard + Wallet Score History
**Duration:** 1-2 days
**Goal:** Read and display Ledger events as a live leaderboard

**Deliverables:**
- `useLedgerScores` hook — reads `MessagePosted` events from TheLedger, filters for `game=litinvaders`, decodes payload, sorts by score descending
- Leaderboard tab: top 20 scores with wallet address, score, wave, relative time
- Auto-refresh every 30 seconds
- "Your Scores" tab: filter by connected wallet address
- Copy address button
- View on explorer link per score
- Loading skeleton while fetching
- Empty state: "No scores yet — be the first!"

**RPC for event reading:**
```
https://liteforge.rpc.caldera.xyz/infra-partner-http
```

**Contract address:** `0xa37fF4bAb59A5F861B48527A946C433dc1Ee8079`

**Event filter:**
```typescript
const filter = {
  address: LEDGER_ADDRESS,
  event: 'MessagePosted',
  fromBlock: 0, // or deployment block
}
```

**Testing Gate:**
- Verify leaderboard updates within 30 seconds of score being posted
- Test with 100 scores — performance of event parsing is acceptable
- Test empty state renders correctly
- Test "your scores" tab with zero scores for a fresh wallet

**Audit Gate (Adversarial):**
- "Can off-chain payload manipulation change the displayed score" — payload decoded from on-chain events; no client-side override possible
- "Leaderboard pagination / skipping — are all scores accessible" — should return all scores, sorted correctly
- "Is the wallet address correctly matched in 'your scores' tab" — must use exact `address` from event, not from payload

---

### Sprint 5: Mobile Controls + Polish
**Duration:** 1-2 days
**Goal:** Shippable on mobile, no rough edges

**Deliverables:**
- Touch controls: left/right tap zones (left half / right half of canvas area), tap to fire
- Mobile layout: canvas scales, controls below
- Sound effects: Web Audio API 8-bit sounds (fire, explosion, alien death, game over)
- CRT scanline CSS overlay
- Title screen animation (aliens marching in)
- Wave complete interlude screen
- SEO meta tags for `/arcade`
- Open Graph image

**Testing Gate:**
- Play one full game on iOS Safari and Android Chrome
- Touch controls responsive and not accidentally firing
- Audio plays correctly (check iOS requires user gesture)
- Canvas renders correctly after window resize

**Audit Gate (Adversarial):**
- "Does the game work with keyboard completely disabled" — touch controls must be fully functional
- "Does audio autoplay before user interaction" — should be blocked until first interaction

---

### Sprint 6: Pre-Launch Security Audit
**Duration:** 1-2 days
**Goal:** Adversarial audit of full game + Ledger integration before public launch

**Deliverables:**
- Full bug hunt by external reviewer (or internal adversarial review)
- All findings addressed
- No HIGH/CRITICAL issues remaining
- Final build deployed to staging environment

**Adversarial Brief for Auditor:**
```
You are reviewing LitInvaders, a Space Invaders clone that posts scores to TheLedger on LitVM (chain 4441).

Threat model:
1. A malicious user tries to post fake/high scores without playing
2. A user tries to trigger the Ledger post on the wrong chain
3. A user tries to manipulate the payload to impersonate another wallet
4. The game state can be corrupted via canvas/WebGL exploits
5. Wallet connection state leaks scores to wrong wallet

Focus areas:
- Ledger post flow: ensure correct chain, correct fee, correct payload encoding
- Wallet state: ensure connected wallet address is used (from wagmi, not from payload)
- Payload integrity: JSON structure, encoding, decoding
- Mobile: touch controls don't allow double-fire exploits
- Leaderboard: event filtering is correct, no score spoofing from off-chain data

Report format: severity (CRITICAL/HIGH/MEDIUM/LOW), description, reproduction steps, recommended fix.
```

---

## 6. Design System Reference

### Typography
- **Title:** Press Start 2P (Google Fonts) — pixel font
- **HUD/Score:** Custom LED segment font or Press Start 2P at smaller size
- **Body/UI:** Geist or Inter — matching Lester Labs site

### Colour Tokens (Tailwind)
```
--color-bg: #000000
--color-lester: #FF00FF
--color-lester-light: #FF69B4
--color-led: #00FF88
--color-gold: #FFD700
--color-white: #FFFFFF
--color-text-muted: rgba(240, 238, 245, 0.5)
```

### Component Style
Match existing Lester Labs dark theme. The game canvas sits inside a styled container with subtle border glow in Lester magenta.

---

## 7. Important Constraints

### Chain Verification
Every Ledger post MUST verify:
1. Wallet is connected
2. `chainId === 4441` (LitVM) — block posts on any other chain
3. `isValidContractAddress(LEDGER_ADDRESS)` — never post to zero address
4. Sufficient balance for 0.01 zkLTC fee

### No Admin Keys / Backend
The game is fully client-side. There is no backend server. All score verification is on-chain via The Ledger. The leaderboard reads from Ledger events. No server-side score storage.

### Open Source
Lester Labs is open source (GitHub: `jh005479-sudo/lester-labs`). This project should be committed to the monorepo at `src/app/arcade/page.tsx` (and sub-components).

### Asset Licensing
All pixel art sprites must be original or use permissive licenses (CC0, MIT). Shitcoin logos are for aesthetic reference only — ensure designer creates original pixel art interpretations, not direct copies of trademarked logos.

---

## 8. Repository Details

**GitHub:** `https://github.com/jh005479-sudo/lester-labs`
**Repo structure:**
```
src/
  app/
    ledger/page.tsx        — existing Ledger page
    pool/page.tsx          — existing DEX pool page
    swap/page.tsx          — existing DEX swap page
    launchpad/page.tsx     — existing launchpad
    arcade/                — NEW: game page
      page.tsx
      components/
        GameCanvas.tsx
        Leaderboard.tsx
        HowToPlay.tsx
        YourScores.tsx
        GameOverModal.tsx
      hooks/
        useGameLoop.ts
        useLedgerScores.ts
      lib/
        gameEncoder.ts      — payload construction + encoding
  config/
    chains.ts              — LitVM chain config
    abis.ts                — LEDGER_ABI
    contracts.ts           — LEDGER_ADDRESS
  components/              — shared Lester Labs components
contracts/                — Solidity contracts (existing)
```

**Key config values:**
```typescript
// src/config/chains.ts
export const litvm = defineChain({
  id: 4441,
  name: 'LitVM Testnet',
  nativeCurrency: { name: 'zkLTC', symbol: 'zkLTC', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://liteforge.rpc.caldera.xyz/infra-partner-http'],
      webSocket: ['wss://liteforge.rpc.caldera.xyz/ws'],
    },
  },
  blockExplorers: {
    default: { name: 'Liteforge Explorer', url: 'https://lester-labs.com/explorer' },
  },
  testnet: true,
})

// src/config/contracts.ts
export const LEDGER_ADDRESS = (process.env.NEXT_PUBLIC_LEDGER_ADDRESS || '0x0000...') as `0x${string}`

// src/config/abis.ts
export const LEDGER_ABI = [ /* as defined above */ ]
```

---

## 9. Definition of Done

Each sprint is complete when:
1. All deliverables are implemented and running locally
2. Testing gate passes without any open issues
3. Audit gate (adversarial brief) reveals no CRITICAL or HIGH issues
4. No TypeScript errors, no console errors
5. Build succeeds (`npm run build`)
6. Page loads and game is playable on both desktop and mobile

**Sprint 6 (full audit) complete when:**
- All CRITICAL and HIGH audit findings resolved
- Game is live on `lester-labs.com/arcade`
- Leaderboard is displaying real on-chain scores
- First scores have been posted and verified on LitVM explorer

# Manual Dapp Regression — 2026-08-11

## Outcome

The activated LiteForge replacement stack was exercised as a public-testnet user from the production-style frontend and through source-equivalent signed contract calls on LitVM chain `4441`. Every broadcast transaction listed below has a successful receipt. No unexpected transaction target, approval spender, native-value recipient, token transfer, credential prompt, recovery-phrase prompt, or opaque signature request was observed.

Six functional/copy defects were found in the served frontend. All are corrected in the accompanying source change and covered by regression tests. One external data-availability mismatch remains: the replacement Ledger reports three messages, while the public explorer archive currently returns only the newest event. The repaired UI renders the available event and discloses the mismatch instead of hanging or claiming that the Ledger is empty.

## Test boundary and key handling

- Network: LitVM LiteForge testnet, chain ID `4441`.
- Disposable public test address: `0x439945924515218061b644901a31aC4A6c00957c`.
- Browser target: public site for served-state checks; rebuilt local production artifact for fix verification.
- The browser profile had no injected wallet extension. Connect controls and pre-wallet form states were exercised in the browser; they correctly rejected the missing extension.
- To exercise the full immutable-contract lifecycle, the supplied disposable testnet key was held only in an in-memory Node session and used to sign the same pinned targets/functions represented by the UI. It was not written to this repository, a report, a command, a screenshot, or a browser field.
- This proves the contract calls, receipts, events, state transitions, and post-action reads. It does not reproduce MetaMask's prompt rendering or constitute a manual wrong-chain extension test. The centralized chain/target/runtime/calldata guard remains covered by repository tests that enumerate every user-accessible write call site and require fresh chain checks around preflight and wallet submission.

## User-flow matrix

| Surface | Flows exercised | Result |
| --- | --- | --- |
| Home | Replacement status, preserved analytics floors plus live post-cutover counters, suite navigation, resume panel, watchlist and saved-search state | Pass. Counters resolved to 517,433 tokens, 16,437 airdrop entries, 8,512 presales, 12,977 swaps, and 66,835 messages, with explicit provenance/limitations. |
| Minter | Name/symbol/supply configuration, review state, fee display, wallet gate, replacement TokenFactory create | Pass. Created LMT at `0xefe4c1b34403734ccadbb1e9001198f93bf94006`; 0.05 zkLTC fee and pinned factory matched. |
| Airdrop | Native two-recipient batch; ERC-20 approval and two-recipient batch; wallet gate | Pass. Four recipient entries were added. Approval spender and both distribution targets were the pinned replacement Disperse contract. |
| Pool | Token approval, add native/token liquidity, pair discovery, position/chart links | Pass. Pair `0x3148d3AF219cFf5FB677f10803C725522B949a99` was created and authenticated through the pinned replacement factory/router. |
| Swap | URL-selected pair, quote/read state, native-to-token swap, token approval, token-to-native swap | Pass after repair. Both swap directions succeeded and the Router counter increased by two. |
| Charts | Pair discovery, pair selection, reserve-ratio disclosures, search, saved search, watch/unwatch state | Pass. The created LMT/zkLTC pair loaded and persistence controls updated the homepage resume panel. |
| Launchpad | Current/legacy source selection, create, fund, contribute, finalize, claim, sweep excess, current sale detail | Pass after repair. Replacement ILO `0x66b1f65e3ff7810d244d52b91c60e3268906124c` completed its lifecycle. |
| Locker | LP approval, create lock, lock certificate/state, expiry, permissionless owner withdrawal | Pass. Lock ID `1` was created and later withdrawn successfully. |
| Vesting | Token approval, schedule creation, schedule discovery, expiry, release | Pass. Child schedule `0xbf40071f66994f92e713e2e7d17516487f9acffd` released successfully. |
| Ledger | Fee/state read, post, receipt/event decode, feed load, transaction link | Pass after repair. The exact regression message now renders as index `#2`; the two-event provider archive gap is disclosed. |
| Explorer | Recent block/transaction samples, saved exact search, exact transaction view, status/value/gas, Ledger calldata decode, address/block links | Pass after repair. The Ledger transaction resolved and decoded correctly. |
| Analytics | Trending, Tokens, Health, DEX, Bridge, Whale Watcher, and Gas tabs | Pass. Tabs switch cleanly and unavailable metrics remain explicitly unavailable rather than synthetic. |
| Portfolio | Disconnected preview, connect control, no-extension path | Pass. No private-key/seed input exists; the page requests only a locally injected wallet and shows a clear missing-extension status. |
| Governance | Spaces, Draft Proposal, Voting Guide, proposal-field editing and draft generation | Pass. Generated an off-chain proposal draft; compromised legacy governance writes remain disabled. |
| Docs, tutorials, security and LitVM information routes | Primary navigation, replacement status, safety guidance and explorer/document links | Pass smoke test. No transactional route bypass was exposed. |

## Successful public transaction evidence

All hashes below returned receipt status `1`.

| Action | Transaction |
| --- | --- |
| Create LMT | `0x5ecde9fa18521e47f40faa752fc803e1cf9fb6460ffc454fd7026f443da9163f` |
| Native airdrop | `0xb37d43a16dc3bcfb923486eaaa35b2d2d642715350d3222d2cefc7a8b0642a7f` |
| Approve token airdrop | `0xc1c2fe8f99b2b5033617665c52ddd5093b5b6ac509723ed8b92474e10b293cd7` |
| Token airdrop | `0xcfc1f1f4c87f23447bd225d9c3447f91d5bd3976c2b8781eedce2944354d5050` |
| Approve Router liquidity | `0x9f56cd0ace2eb2267ce9eb0a31bb29080dc8171a0c31102232d8ea13bd190672` |
| Add liquidity | `0x2040585e818c317ae7a7c8ad6bec54d3d29883b24c1274f1c813359a2b3daa38` |
| Native-to-token swap | `0x4c03c7c74f99c194d54e3d928a6d2ca341876fa4ec129013542e951da4c5fece` |
| Approve reverse swap | `0xd922cd5f199e07e2fddf50acd428a91852863571222dce89706748f8abb07806` |
| Token-to-native swap | `0x0c5691c038de5b346a5a676ab335e8373f36c15f4364eedf9646b434077f36cc` |
| Approve vesting | `0xa8d504193e7226a69280e18cfca78eba2f47578142f2983fe13567fd3fbddf3a` |
| Create vesting schedule | `0xf94833f2f8ea014cda4785fde545fc5dd3516eacb78accfdcfbc0a90b30e8e8f` |
| Release vested tokens | `0x8418100608b211482633ee0af9dab12f8e00bd37252c57ec922577073f8302b2` |
| Post Ledger message | `0xf4d25d5d000e0f99aff7773b54e26241e8551a3992cdd8cb42cbb3cf09f96386` |
| Create ILO | `0x83de3e50fc94f0ce7b3e6b8e8d1dc3bf846f0e826de897322c5ad587da4a23af` |
| Fund ILO | `0xffbeabf84400bbf63273e199b31c6a5f7d508160139500797603d2ec31e2c5fe` |
| Contribute | `0x663feedaeb3012ed390868975912b7e1c47792ca2b808e52aad7055dab2d2659` |
| Finalize ILO | `0x2dcb96b5b69931d2a083d147dd07034f1d688063a423582a6f63f20fe474dcec` |
| Claim ILO tokens | `0xc6e3918f019eec8b9bf46dc4be8c128ac3010d2a1311e69fd0d281b1732ef45a` |
| Sweep ILO excess | `0x660fc93fd5d0bceb2766efb87118c1a4993ce999ec2d86a7571a14866f52627f` |
| Approve LP locker | `0x7825366492e6fbc0777b1e37a49da40dc3c7d04afc6ec67d9d6e34290fb6faf5` |
| Create LP lock | `0x3b89aa8cb6b8631e83e9d8190b267e0a32e7f3ad1fd9f8db228e09d249d3f8a9` |
| Withdraw expired LP lock | `0x56535aa10218a6f1f068c438655911d43f6a96d3164c4a57600b052d23824654` |

## Findings and repairs

1. **Launchpad source selection:** the browse view was hardwired to the retired factory and described creation as disabled even after replacement activation. The page now defaults to current replacement sales, exposes an explicit current/legacy selector, and derives create labels/copy from the reviewed release state.
2. **Launchpad detail copy:** authenticated replacement ILOs still displayed non-live/disabled instructions. Action and provenance copy now follows the paid-write authentication result.
3. **Swap activation and deep links:** the activated Router was still labelled a read-only legacy quote, and `token0`/`token1` URL selections were ignored. Current replacement copy and URL pair initialization are restored.
4. **Token metadata resilience:** one bursty RPC failure could label a valid token invalid. Metadata reads are now sequential and retried three times; an unresolved read is reported as an RPC failure, not a token-validity verdict.
5. **Ledger history:** the feed requested indexed logs from block `1`, exceeding the six-second RPC deadline and presenting an empty feed after a successful post. History now uses the chain's pinned official explorer index, permits CSP connection only to that exact origin, bounds the page, validates the returned contract address and event signature before decoding, and reports counter/archive mismatch. WebSocket and bounded RPC polling still handle live events.
6. **Stale labels:** replacement Ledger, Vesting, Explorer transaction, and shared activity copy still contained legacy/candidate wording. These labels now reflect the activated source-pinned replacement state.

## Residual limitations

- The public explorer archive currently returns one of three counter-recorded replacement Ledger messages. This is an upstream archival/indexing gap, not evidence that the successful newest receipt is missing; the exact newest receipt and event are retrievable. The frontend now states the gap.
- No injected MetaMask instance was available in the automation browser. A human should still perform a final extension-specific UX pass on an isolated browser profile: chain `4441`, a deliberate wrong-chain rejection, decoded prompt target/value/calldata, rejection/cancellation, and account/network changes mid-flow.
- This was a valueless testnet regression. It is not a production authority, economic, load, MEV, or multi-user adversarial test.

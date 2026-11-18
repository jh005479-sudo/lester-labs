# Zeeve migration and locker recovery

## Network checks on 18 November 2026

The public testnet uses chain 4441, the Zeeve HTTP RPC and the Zeeve explorer. Wallets that already have this chain must update their saved URLs. Ledger refresh uses HTTP polling. The published network configuration currently lists no replacement WebSocket. [LitVM network configuration](https://docs.litvm.com/get-started-on-testnet/network-configuration.md)

Zeeve and the public RPC at rpc-litvm.pro agreed on the following reads. The independent service rate-limits code reads, so the checks were paced.

| Check | Observation |
| --- | --- |
| Recent header | Block 72,304,252, hash `0xc278a890f69d233f996ae5855f0f338f9d2301af084b86ef48b408949ea20244` |
| Historical header | Both matched the approved cutover hash at block 38,999,871 |
| TokenFactory deployment receipt | Both returned success, the manifest contract address and receipt block hash `0x5469affdfbb3beac6ce10e8abf6db5681b5a107c7a4b9e24a21a39550d0ac331` |
| Manifest bytecode | All 13 latest runtime hashes and byte lengths matched the approved manifest on both services |
| Factory reads and simulation | Each reported 0.05 zkLTC. An unsigned `eth_call` simulating the payable creation returned the same address on both services |
| Candidate APIs | The local candidate returned eight recent blocks, 50 token events with a continuation cursor, 30 pool events and live coverage for all five homepage counters |

Zeeve also served all 13 runtime hashes at block 72,303,668. Another recent historical state read returned a history-unavailable error. Header availability does not establish archive-state retention. Preserve the original signed cutover evidence. A future historical attestation needs providers that can serve the exact requested state.

## Locker generations

The August 2026 public locker at `0xEfE43FB51a3219B35Ffc30e508e14003752fc18f` records requested amounts. The application blocks new deposits and token approvals for its runtime. A dated certificate identifies the locker generation and recorded balance. Eligible owners can continue withdrawing by locker address and lock ID, including after a replacement is selected.

The corrected Solidity contract checks its token balance before and after transfer and rejects an inexact increase. The local regressions cover rejected and exact transfers, fee forwarding, maturity and a single payout to the designated beneficiary. Old records cannot be repaired by changing the frontend. Enabling new deposits requires a reviewed deployment, independent code and authority verification, a new source-pinned release manifest, and protected promotion. No replacement contract or public release was deployed as part of this change.

## Release review

The eight missing route sources now have probes. A pull-request check compares the policy with tracked route sources. Public and staged verification also validates the live JSON schemas. The wallet-free emergency surface rejects the eight new paths. The mobile browser journeys include loaded and dated fallback counters at three widths, enlarged text, forward and reverse keyboard traversal, Escape focus restoration, unavailable fees and explorer counts, and disconnected tool landmarks.

Production-only dependency audits are clear. The full tooling audits still block release. The protected Linux frontend workflow accepts only the exact SHA on protected main. The existing on-chain verifier checks the ordered stack manifest. A standalone locker receipt cannot activate the replacement. Retain the signed August evidence and require a reviewed deployment and manifest before enabling deposits. [Dependency review](NOVEMBER-2026-DEPENDENCY-REVIEW.md)

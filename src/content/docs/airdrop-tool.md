# LitVM Airdrop Tool — Local Review and Replacement Readiness

> **Release-aware status:** local CSV parsing, address validation, batching
> previews, and reports remain available. Distribution writes exist only in a
> source-pinned replacement candidate, and that candidate may be served publicly
> only after the separate frontend approval and parity gate passes.

The word “airdrop” describes a sender-directed batch-transfer utility. Using or
viewing this tool does not enrol a wallet in a reward programme, prove token
eligibility, or establish LitVM/Litecoin endorsement.

## Safe preparation during containment

1. Use only test assets and a disposable testnet wallet.
2. Prepare rows as `address,amount`, using display-unit amounts.
3. Review every parsed row, the token decimals, duplicate addresses, total
   amount, and proposed batches locally.
4. Do not approve a token or sign a distribution while the interface reports
   containment.
5. Export the local review report if useful; it is not an on-chain receipt.

Lists over 200 valid rows are intended to be split into separate future
transactions. Duplicate addresses remain separate **recipient entries**, so an
entry counter is not a unique-wallet count.

## Legacy deployment

The Disperse contract at
`0x3cc66cb4713dca78564df512922adb331ac5ee04` is historical only. Do not grant
it a new allowance or call it directly. Its address is retained solely for
historical analysis and provisional activity continuity.

## Replacement behavior

The reviewed replacement:

- accepts 1–200 positive-value, nonzero-recipient entries per batch;
- transfers exactly the caller-specified token/native values;
- has no owner-controlled recipient list or treasury sweep;
- emits authenticated distribution summaries; and
- increments a monotonic `totalRecipientEntries` counter.

That counter includes duplicate addresses and multiple entries for the same
wallet. It must be labelled as recipient entries, never as counts of distinct
wallets or people.

Before future activation, the exact replacement address/runtime and allowed
`disperseToken` / `disperseEther` calls must be source-pinned. ERC-20 mode must
request only the exact batch total from the approved replacement spender; each
batch needs its own wallet review and receipt. No dependency or upstream
Disperse ancestry is proof that a deployment is safe.

# LitVM Airdrop Tool — Immutable Public-Testnet Replacement

> **Active replacement status:** local CSV parsing, address validation, batching
> previews, and reports are available. Distribution writes target only the
> source-pinned immutable replacement on chain `4441` after runtime and chain
> checks pass.

The word “airdrop” describes a sender-directed batch-transfer utility. Using or
viewing this tool does not enrol a wallet in a reward programme, prove token
eligibility, or establish LitVM/Litecoin endorsement.

## Safe use

1. Use only test assets and a disposable testnet wallet.
2. Prepare rows as `address,amount`, using display-unit amounts.
3. Review every parsed row, token decimals, duplicate address, total amount,
   proposed batch, target, spender, and native value.
4. Confirm the wallet is on LitVM LiteForge chain `4441`; the app blocks the
   transaction if it cannot prove the connected chain and target runtime.
5. Review each wallet confirmation and receipt independently.

Lists over 200 valid rows are split into separate transactions. Duplicate
addresses remain separate **recipient entries**, so the counter is not a count
of unique wallets.

## Legacy deployment

The Disperse contract at
`0x3cc66cb4713dca78564df512922adb331ac5ee04` is historical only. Do not grant
it a new allowance or call it directly. Its address is retained solely for
historical analysis and the frozen analytics floor.

## Replacement behavior

The approved replacement at
`0x80Cc00444Ac78959520052A3333184C5E81B0EA5`:

- accepts 1–200 positive-value, nonzero-recipient entries per batch;
- transfers exactly the caller-specified token or native-testnet values;
- has no owner-controlled recipient list, upgrade path, or treasury sweep;
- emits authenticated distribution summaries; and
- increments a monotonic `totalRecipientEntries` counter.

ERC-20 mode requests only the exact batch total for this source-pinned spender.
Each batch needs its own wallet review and receipt. Chain, address, function,
spender, value, and runtime checks fail closed before any wallet write request.
No dependency or upstream Disperse ancestry is proof that a deployment is safe.

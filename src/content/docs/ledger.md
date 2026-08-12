# The Ledger

The Ledger publishes short messages as LitVM transaction data and emits an
event that can be displayed in the Lester Labs message feed.

## Contract

| Parameter | Value |
|---|---|
| Address | `0xEdf195A557EaAE7829f867d6f84316908A65D9B1` |
| Minimum post fee | `0.01 zkLTC` |
| Maximum message size | `1,024 bytes` |

## Post a message

1. Open the Ledger and enter a message.
2. Review the UTF-8 byte count and posting fee.
3. Submit the transaction.
4. Follow the transaction or event in the LitVM explorer.

## Contract functions

| Function | Description |
|---|---|
| `post(message)` | Publishes a nonempty byte string and emits `MessagePosted` |
| `messageCount()` | Returns the number of messages posted to the contract |
| `MIN_FEE()` | Returns the current minimum posting fee |

`post` is payable. The attached value must be at least `MIN_FEE()`, and the
message must contain between 1 and 1,024 bytes.

## Message events

```solidity
event MessagePosted(
  address indexed sender,
  uint256 indexed index,
  uint256 timestamp,
  bytes data
);
```

The website reads recent `MessagePosted` events in pages. For older messages,
query the event directly by contract address, block range, or transaction hash.

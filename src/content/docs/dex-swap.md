# LitVM DEX — Immutable Replacement and Legacy Recovery

> **Active replacement status:** new testnet swaps, wrapping, pool creation, and
> liquidity actions use only the source-pinned immutable replacement on chain
> `4441`. The legacy factory/router/wrapper tuple remains recovery-only.

## Fee behavior and scanner transparency

Both the legacy and approved testnet pair use Lester-specific, non-canonical
fee routing. For each measured swap input, `0.20%` is transferred directly to
factory `feeTo` and approximately `0.10%` remains in the pool, producing the
router's effective `997/1000` quote behavior. This is not Uniswap V2's optional
LP-mint protocol-fee mechanism.

An extra input-token recipient can resemble a drainer heuristic to transaction
scanners. It is not a hidden wallet sweep: the transfer and amount are in the
published pair source, the replacement recipient is the disclosed valueless
test treasury, and `feeToSetter` is permanently frozen at
`0x0000000000000000000000000000000000000001`, so the destination cannot be
redirected. Users should still review the exact output minimum, path, recipient,
deadline, value, and decoded call before signing.

The legacy version is retired because its compromised mutable `feeToSetter`
could redirect the recipient. Its recovery-only tuple is:

| Contract | Recovery-only address |
|---|---|
| Factory | `0x017A126A44Aaae9273F7963D4E295F0Ee2793AD8` |
| Router | `0xD56a623890b083d876D47c3b1c5343b7f983FA62` |
| Wrapped zkLTC | `0xd141A5DDE1a3A373B7e9bb603362A58793AB9D97` |
| Launchpad connector | `0x720A547a29F1C86E0Ef0BE5864FAF14a69E894fD` |

These are historical references, not approved new-activity targets. The legacy
connector immutably embeds the retired treasury and must never be reused.

## Replacement targets and controls

| Contract | Approved public-testnet address |
|---|---|
| Factory | `0x301D649fE86d5CAE665944B3C7942bF9f29B81Ca` |
| Router | `0xf2CA3a3A42136Fd103346914A37b30f3991315EA` |
| Wrapped zkLTC | `0xA13C8Ea8E4084AeEbcdb1B951dEDF2d641567ed0` |
| Launchpad connector | `0xbB4e527216ac0e0709Bf57ff718ca417ba85AaDF` |

The factory controller is permanently frozen, the fee recipient has no admin
role, and the contracts have no upgrade path. Before every write, the frontend
enforces chain `4441`, exact target/function/value/spender rules, and the
attested runtime. It asks the wallet to switch networks when needed and fails
closed if the chain or runtime cannot be proved.

The router adds a monotonic successful public-router swap-action counter for
continuity analytics. It counts one successful public router call, regardless
of hop count, and excludes direct pair swaps. It is not volume, unique users, or
a complete activity index.

## Existing-position recovery

Replacing a DEX does not migrate old LP tokens. Recovery may require the exact
original router:

1. Use only a tuple in the reviewed legacy recovery registry.
2. Verify all runtime hashes and confirm pair `token0()`, `token1()`, and factory
   provenance.
3. Confirm router `factory()` and `WETH()` match the same tuple.
4. Choose explicit minimum outputs and a short deadline, with the connected
   wallet as recipient.
5. Approve only the exact LP amount immediately before the authenticated
   `removeLiquidity` call, then revoke any residual allowance.

Never swap, wrap, add liquidity, create a pool, or grant a reusable allowance
to the retired router. Existing wrapped-native withdrawal is limited to an
authenticated `withdraw(amount)` call against the source-pinned legacy wrapper.

## Read-only quotes and charts

Quotes and reserves are untrusted read-only inputs, not oracle prices, USD
valuations, fair value, or execution promises. The chart loads at most the 72
newest factory pairs and up to 80 recent `Sync` points within a bounded
30,000-block lookback. It is not a complete DEX index.

## Network configuration

```json
{
  "chainId": "0x1159",
  "chainName": "LitVM LiteForge",
  "nativeCurrency": { "name": "zkLTC", "symbol": "zkLTC", "decimals": 18 },
  "rpcUrls": ["https://liteforge.rpc.caldera.xyz/http"],
  "blockExplorerUrls": ["https://liteforge.explorer.caldera.xyz"]
}
```

Cross-check network values through LitVM's independently located official
documentation. Upstream Uniswap ancestry is not an audit of this Lester fork,
deployment, frontend, or role configuration.

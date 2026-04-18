# Swap Feature — Implementation Notes

> Status: implemented locally on the working branch. Live LitVM deployment still requires the Lester treasury multisig to execute the deploy scripts and publish final router/factory addresses.

## Scope

The Lester Labs DEX rollout covers three connected surfaces:

- `/swap` for wallet-connected trading
- `/pool` for LP balance and exposure discovery
- Launchpad finalization wired into the same Lester Labs Uniswap V2 deployment

## Fee Model

| Recipient | Amount |
|---|---|
| Lester Labs treasury | `0.20%` |
| LPs retained in-pool | `0.10%` |
| **Total per trade** | **`0.30%`** |

Treasury wallet:

`0xDD221FBbCb0f6092AfE51183d964AA89A968eE13`

This split is enforced in the pair contract, not just in frontend config.

## Contracts

Implemented under `contracts/contracts/uniswap/`:

- local `UniswapV2Factory`
- local `UniswapV2Pair`
- local `UniswapV2Router02`
- wrapped native asset contract for zkLTC router compatibility
- `UniSwapConnector.sol` for Launchpad finalization

Key Lester Labs-specific behavior:

- factory constructor sets both `feeTo` and `feeToSetter` to the treasury
- pair `swap()` routes `0.20%` of input directly to treasury and leaves `0.10%` for LPs
- `UniSwapConnector` refuses to add launch liquidity if factory routing drifts away from treasury

Deploy scripts:

- `contracts/scripts/deploy_uniswap_v2.ts`
- `contracts/scripts/deploy.ts`

## Frontend

Implemented routes:

- `src/app/swap/page.tsx`
- `src/app/pool/page.tsx`

Behavior:

- token selection backed by LitVM token metadata
- live quotes from router `getAmountsOut`
- ERC-20 approval flow inline before swap submission
- shared `TxStatusModal` for transaction state
- LP page scans factory pairs and connected-wallet balances

## Environment Variables

```env
NEXT_PUBLIC_LITVM_RPC_URL=https://liteforge.rpc.caldera.xyz/infra-partner-http
NEXT_PUBLIC_UNISWAP_V2_FACTORY_ADDRESS=
NEXT_PUBLIC_UNISWAP_V2_ROUTER_ADDRESS=
NEXT_PUBLIC_WRAPPED_ZKLTC_ADDRESS=
```

These remain environment-driven until the live deployment is executed.

## Deployment Sequence

1. Run `cd contracts && npm run deploy:uniswap:litvm`
2. Export the deployed factory, router, and wrapped-native addresses to frontend env
3. Run `cd contracts && npm run deploy:litvm`
4. Confirm `ILOFactory` points to `UniSwapConnector`
5. Verify `feeTo` and `feeToSetter` both equal `0xDD221FBbCb0f6092AfE51183d964AA89A968eE13`

## Notes

- The router still uses a wrapped-native contract under the hood because standard Uniswap V2 periphery expects a wrapped asset
- Runtime swaps do not depend on an external DEX
- The implementation intentionally stays close to Uniswap V2 and existing Lester Labs frontend patterns

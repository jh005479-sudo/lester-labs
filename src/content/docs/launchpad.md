# LitVM Launchpad — Historical Recovery and Replacement Readiness

> **Current status:** both known ILO factories and every child created by them
> are legacy deployments. New creation, sale-token funding, contributions,
> whitelist changes, and finalization are disabled. State-dependent
> cancellation, refund, token claim, LP claim, and excess-asset recovery remain
> available only for source-authenticated children.

Do not send tokens or zkLTC directly to a legacy factory or ILO. A contract
remaining callable on-chain is not an endorsement to use it.

## Source-pinned historical factories

| Deployment | Address | Provisional child count at block 36,723,038 |
|---|---|---:|
| Production legacy ILO Factory | `0xC9B1961def0cC5bc1ffe3cFe37a4988D7987A43f` | 8,330 |
| Earlier legacy ILO Factory | `0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB` | 121 |

The counts are first-party continuity records, not independently verified launches or
distinct projects. Both factories copied the retired treasury/controller into child
configuration, and the legacy connector at
`0x720A547a29F1C86E0Ef0BE5864FAF14a69E894fD` immutably embeds that retired
treasury.

## Recovery flow

1. Open a child only through a source-pinned factory registry entry.
2. Verify the factory and child runtime hashes, creation provenance, current
   owner, treasury, token, sale state, and the exact connected wallet's role.
3. Do not fund, contribute, change a whitelist, or finalize.
4. Use only the recovery action permitted by the current state:
   - owner cancellation where allowed;
   - contributor refund after failure/cancellation;
   - contributor token claim after an already completed finalization;
   - owner LP claim after the recorded lock expiry; or
   - owner excess zkLTC/token recovery where the reviewed child permits it.
5. Review the exact target, function, zero/native value, and recipient before
   signing, then verify the receipt independently.

The application must fail closed for an unregistered factory or child runtime.
An explorer label, matching project name, or direct URL is not sufficient
provenance.

## Historical parameters

Legacy contracts used a `0.03 zkLTC` creation fee and a `2%` finalization fee.
Those values are historical behavior, not a current service offer. Automatic
LP creation and locking are disabled because they would route through the
retired connector and compromised DEX controls.

## Replacement design

The prepared replacement creates one ILO child per reviewed request and uses a
new connector. The deployment separates:

- **controller:** owns limited factory/connector administrative authority;
- **treasury:** receives platform fees and must match DEX `feeTo`;
- **single-use deployer:** broadcasts the attested deployment sequence only.

The DEX factory's distinct `feeToSetter` must equal the controller, not the
treasury. Before seeding liquidity, the connector must verify both mappings,
the pinned router/factory/wrapped-native tuple, balances, allowances, minimum
outputs, and recipient. It resets temporary token allowances after use and
cannot sweep funds to an arbitrary caller.

No future-design description on this page authorizes a transaction today. New
creation may be enabled only after the factory, connector, child runtime,
treasury/controller role graph, and clean served frontend are independently
attested and source-pinned.

## Security limitations

- A soft cap and direct refund path do not protect against a malicious token or
  misleading project.
- An LP lock restricts the recorded LP tokens; it does not prove token value,
  liquidity quality, ownership safety, or project legitimacy.
- “Permissionless” does not mean reviewed, endorsed, or safe.
- Upstream Unicrypt-style inspiration is not an audit of Lester Labs.

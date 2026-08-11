# Token Factory — Immutable Public-Testnet Replacement

> **Active replacement status:** new token creation targets only the
> source-pinned immutable factory on LitVM LiteForge chain `4441`. The legacy
> factory remains retired and read-only.

## Legacy deployment

The factory at `0x93acc61fcdc2e3407A0c03450Adfd8aE78964948`
remains associated with compromised legacy authority. Do not call its
`createToken` function or send zkLTC to it. Existing child tokens remain
independent ERC-20 contracts; replacing the factory does not alter their owners
or make them trusted.

The legacy creation fee was `0.05 zkLTC` and accrued under the compromised
factory owner. That is a historical parameter, not a current offer.

## Approved replacement

The approved factory is
`0x1A098a86d4C73b44d38e40711e0dd869591B4F60`. It:

- was created in the source-pinned attested deployment sequence;
- has its administrative owner permanently frozen at
  `0x0000000000000000000000000000000000000001`;
- forwards each `0.05 zkLTC` testnet creation fee directly to the disclosed
  valueless test treasury rather than accumulating funds for an owner sweep;
- has no upgrade path and rejects invalid role addresses; and
- is reachable only after the frontend proves chain `4441`, the exact factory
  address/runtime, function, and native value.

The fee recipient has no controller authority. This testnet-only authority
model does not replace the distinct multisig controller/treasury requirements
for a future real-value production deployment.

## Child-token behavior

Token creators select custom decimals and optional owner minting, holder
burning, and owner pause controls. The initial supply is minted to the creator.
Child-token ownership belongs to the creator, not Lester Labs:

- `mint(address, amount)` — child-owner only, when enabled at creation;
- `burn(amount)` — holder action, when enabled at creation; and
- `pause()` / `unpause()` — child-owner controls, when enabled.

Verify a child's exact runtime, owner, mintability, pause controls, supply, and
factory-event provenance. A matching name or symbol does not prove factory
origin. The explorer list is a bounded newest-event sample, not a complete
index.

OpenZeppelin ancestry does not constitute an audit of Lester Labs, the
deployment process, or a token creator's choices.

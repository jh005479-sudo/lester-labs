# Token Factory — Containment and Replacement Readiness

> **Current status:** the legacy Token Factory at
> `0x93acc61fcdc2e3407A0c03450Adfd8aE78964948` remains controlled by the
> compromised legacy authority. New token creation and its paid write are
> disabled. Do not call `createToken` directly or send zkLTC to the factory.

## Historical behavior

The legacy factory deployed `LesterToken` ERC-20 contracts and minted the
configured initial supply to the caller. Token creators selected custom
decimals and optional owner minting, holder burning, and owner pause controls.
Each child token has its own transferable owner; replacing the factory does not
change a child token's owner or make a historical token trusted.

The legacy creation fee was `0.05 zkLTC` and accrued under the compromised
factory owner. That fee is a historical parameter, not a current offer.

## Safe use during containment

- Existing child tokens can still be inspected as independent ERC-20
  contracts.
- Verify a token's exact runtime, owner, mintability, pause controls, supply,
  and factory-event provenance before relying on it.
- A matching name or symbol does not prove that a token came from the factory.
- Do not approve, pay, or deploy through the legacy factory.
- The Lester explorer's factory-token list is a bounded newest-event sample,
  not a complete index.

## Replacement design

A replacement factory is prepared but not active. Its reviewed deployment must:

- be deployed from the separately attested single-use gas EOA;
- place administrative ownership with the approved **controller**;
- forward creation fees directly to the distinct approved **treasury** rather
  than accumulating them for an owner sweep;
- reject zero or retired role addresses and pin its exact runtime hash; and
- remain unreachable from the frontend until the served build and the explicit
  paid-write allowlist are verified.

Controller and treasury are deliberately different roles. “The owner matches
the treasury” is not a valid activation check.

## Intended replacement interface

- `createToken(...)` — deploy a configured ERC-20 child; disabled until activation
- `owner()` — returns the controller, not the fee recipient
- child `mint(address, amount)` — child-owner only, when enabled at creation
- child `burn(amount)` — holder action, when enabled at creation
- child `pause()` / `unpause()` — child-owner controls, when enabled

## Sources and limitations

The token implementation composes OpenZeppelin modules with Lester-specific
configuration. Upstream review does not constitute an audit of Lester Labs,
the deployment process, or a token creator's choices. No replacement should be
described as live until its address, constructor inputs, runtime hash, roles,
and served-frontend target have all been independently verified.

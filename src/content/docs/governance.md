# Governance — Retired Legacy Stack and Replacement Readiness

> **Current status:** the legacy governance token, governor, and timelock are
> retired and read-only. Proposal submission, voting, delegation, queueing,
> cancellation, and execution are disabled in the Lester Labs application.

Live-chain review found that the compromised controller owns the legacy voting
token, holds the concentrated delegated supply, and retains timelock admin and
canceller authority while the timelock has no executor. Those addresses must
not be described as canonical governance or revived merely because the main
application contract set is replaced.

## Historical addresses

| Contract | Retired address |
|---|---|
| LitGovToken | `0xa5111cedc04554676DbCCA39F2268070008C7A8A` |
| LitGovernor | `0x5b0092996BA897617B46D42B3F108B253be9Ad3d` |
| LitTimelock | `0xd38ed693730Db3eB22bA6d6F0050FC45Ac9240ba` |

The explorer may display historical calls, but must label the token and role
graph as retired. A matching `LGT` symbol is not identity or provenance.

## Safe governance work during containment

Teams may draft proposal text locally, document an intended action, identify a
public discussion link, and state a future execution path. This is planning
only. The Lester Labs UI does not publish to Snapshot/IPFS, collect votes, or
execute an on-chain action.

Do not ask a community to sign an opaque typed-data payload or send a vote to
the retired contracts. Any third-party forum or Snapshot space must be verified
independently and is outside Lester Labs' security boundary.

## Replacement design

The prepared replacement uses a fresh governance token, timelock, and governor:

- the treasury receives and self-delegates the initial governance supply;
- the timelock owns any future mint authority;
- the governor is the sole timelock proposer and executor;
- the distinct controller is an emergency canceller, not the treasury; and
- the timelock is its own sole administrator after deployment.

Governance has a separate activation latch from the rest of the application.
All three addresses, exact runtime hashes, constructor inputs, initial balances,
delegations, and final timelock roles must be independently attested and
source-pinned together before any governance write can be enabled.

No governance outcome is proof of safety or value, and source availability is
not an audit.

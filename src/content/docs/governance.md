# Governance — Intentionally Disabled Immutable Testnet Stack

> **Legacy deployment status:** the legacy governance token, governor, and timelock are
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

## Safe governance work

Teams may draft proposal text locally, document an intended action, identify a
public discussion link, and state a future execution path. This is planning
only. The Lester Labs UI does not publish to Snapshot/IPFS, collect votes, or
execute an on-chain action.

Do not ask a community to sign an opaque typed-data payload or send a vote to
the retired contracts. Any third-party forum or Snapshot space must be verified
independently and is outside Lester Labs' security boundary.

## Replacement status

The immutable testnet deployment includes a fresh governance token, timelock,
and governor, but governance writes intentionally remain disabled:

- the complete test governance supply and its delegated votes are held by the
  no-key `0x…01` precompile, not the disclosed test treasury;
- the emergency canceller is also frozen at `0x…01`, while the timelock's
  self-administered Governor path cannot meet the proposal threshold; and
- the frontend governance latch is false even though the three exact runtimes
  are retained in the verified deployment manifest.

No governance write is authorized for this testnet profile. A future production
governance deployment requires a separate reviewed, executable multisig/
timelock authority design and cannot activate merely by changing frontend copy.

No governance outcome is proof of safety or value, and source availability is
not an audit.

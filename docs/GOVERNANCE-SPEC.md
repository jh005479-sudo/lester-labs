# Governance replacement specification

## Status and scope

The source in this repository describes the reviewed post-compromise
replacement. It is not the currently trusted live governance system, and its
addresses remain undefined in the frontend until the thirteen-contract
replacement manifest passes independent verification and cutover review.

The legacy governance stack is unsafe: `LitGovToken` ownership and all initial
voting supply remain associated with the retired compromised controller; that
controller also holds Timelock admin and canceller authority; and the legacy
Timelock has no executor. Preserve those contracts as read-only evidence only.

## Replacement contracts

### `LitGovToken`

- OpenZeppelin ERC-20 and ERC20Votes token named `Lit Governance Token` (`LGT`).
- In the production profile, the constructor mints exactly 10,000,000 LGT to
  the reviewed treasury and self-delegates that balance so voting power is
  immediately visible.
- In the disposable functional-test profile, the same supply is minted and
  self-delegated to LitVM's verified `0x…01` ECRECOVER precompile. No account
  can transfer or exercise that voting power, so the disposable governance
  graph is intentionally inert.
- Mint ownership is assigned directly to the predicted `LitTimelock` address.
  There is no deployer-owned bootstrap or post-deployment ownership transfer.
- The deployment signer receives no token balance or votes.
- Timelock-governed `mint`, `batchMint` (maximum 200 recipients), and ownership
  transfer remain possible. Ownership cannot be transferred to the deployment
  signer or the initial holder.

Transfers move delegated votes according to ERC20Votes. A recipient must call
`delegate(recipient)` or delegate to another account to activate the received
voting weight; receiving later tokens does not silently change its delegate.

### `LitTimelock`

- Minimum delay: 172,800 seconds (two days).
- `DEFAULT_ADMIN_ROLE`: the Timelock contract itself, and nobody else at
  construction.
- `PROPOSER_ROLE`: only the predicted `LitGovernor`.
- `EXECUTOR_ROLE`: only the predicted `LitGovernor`; execution is not open to
  the zero address.
- `CANCELLER_ROLE`: only the reviewed controller. OpenZeppelin initially grants
  this role to each proposer, so the constructor explicitly revokes it from the
  Governor before granting it to the controller.
- The deployment signer and treasury have no role.

The controller can cancel a queued Timelock operation directly. The Governor
detects that its stored operation ID changed from scheduled to unset and then
reports the proposal as permanently `Canceled`; it cannot be queued again.

### `LitGovernor`

The replacement is the repository's minimal on-chain Governor using
ERC20Votes snapshots and OpenZeppelin TimelockController execution:

- voting delay: 1 block;
- voting period: 45,600 blocks;
- proposal threshold: 100,000 LGT;
- quorum: 4% of total supply at the proposal snapshot;
- choices: Against, For, and Abstain;
- lifecycle: Pending → Active → Defeated or Succeeded → Queued → Executed, with
  durable Canceled state;
- proposal descriptions and target/value/calldata arrays are stored on-chain;
- queue and execute use a deterministic salt derived from Governor address and
  proposal ID.

The proposal creator can cancel only Pending, Active, or Succeeded proposals.
Once queued, the controller's Timelock canceller role is the emergency path.

`execute(uint256)` and `executeTimelocked(uint256)` are nonpayable, and the
Governor has no `receive` function. A proposal that transfers native value must
therefore use native currency already held by the Timelock. Sending value to
the Governor or attaching value to `execute` reverts.

## Predicted deployment graph

Governance is transactions 11–13 in the single post-compromise CREATE sequence:

1. Predict Token, Timelock, and Governor addresses from the fresh single-use
   gas EOA and pinned starting nonce.
2. Deploy Token with predicted Timelock as owner. The initial holder is the
   treasury in production and frozen `0x…01` in the disposable profile.
3. Deploy Timelock with predicted Governor as proposer/executor and controller
   as emergency canceller.
4. Deploy Governor after both referenced contracts have runtime code.

In production, controller, treasury, and gas-only deployer must all be distinct,
and both known incident addresses are rejected for every role. In the
disposable profile, the disclosed signer may equal the fixed test-fee treasury
but cannot equal the frozen controller; this manifest is forbidden from public
frontend activation or reputation-remediation evidence.

## Verification gates

Before frontend activation, the replacement manifest verifier must establish:

- exact CREATE transactions, constructor calldata, runtime hashes, and local
  constructor simulation for all thirteen deployments;
- exact 10,000,000 LGT initial supply, profile-specific initial-holder
  balance/delegation/votes, and zero deployer balance/votes;
- Token owner equals Timelock;
- Timelock's sole-role graph matches the specification above and no role is
  open to the zero address;
- Governor token, Timelock, voting parameters, and initial proposal count are
  exact; and
- source-pinned frontend addresses are changed only from the final verified
  manifest in a separately reviewed cutover.

Tests additionally cover successful queue/execute after delay, rejection of
early execution, durable direct-Timelock cancellation, nonpayable Governor
behavior, and prefunded-Timelock native-value proposals.

## Frontend behavior

The governance UI may display proposal state, stored proposal details, vote
tallies, current voting power, balances, and delegatees. Any create, vote,
queue, cancel, or execute control must remain disabled while governance target
addresses are undefined or fail source/runtime/role attestation. UI copy must
not describe token balance as voting power unless `getVotes(account)` confirms
delegation.

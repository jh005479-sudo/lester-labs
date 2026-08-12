# Governance

The Governance section provides contract data, proposal views, and a local
proposal-drafting interface for LitVM testnet.

On-chain proposal, voting, queue, and execution actions are not enabled in the
current Lester Labs interface. Drafts remain local until they are copied into
another workflow.

## Contracts

| Contract | Address |
|---|---|
| Lit Governance Token (`LGT`) | `0x7c1A67Ec89c22b8a738DD881289576102306219C` |
| Governor | `0x05e29e239C6e40EcF9639781bba5D558b9f98305` |
| Timelock | `0x17Ddf4d2e7C0789f600d4f7182785e9E193b44aA` |

## Governance parameters

| Parameter | Value |
|---|---:|
| Voting delay | 1 block |
| Voting period | 45,600 blocks |
| Proposal threshold | 100,000 `LGT` |
| Quorum | 4% |
| Timelock delay | 172,800 seconds (2 days) |

## Token functions

The governance token implements ERC-20 and ERC-20 Votes interfaces.

| Function | Description |
|---|---|
| `delegate(delegatee)` | Assigns voting power to a delegate |
| `getVotes(account)` | Returns current delegated voting power |
| `getPastVotes(account, blockNumber)` | Returns voting power at a past block |
| `getPastTotalSupply(blockNumber)` | Returns total supply at a past block |
| `nonces(account)` | Returns the signature nonce for an account |

## Governor functions

| Function | Description |
|---|---|
| `proposalCount()` | Returns the number of proposals |
| `proposals(proposalId)` | Returns core proposal timing and proposer data |
| `proposalDetails(proposalId)` | Returns targets, values, calldata, and description |
| `proposalVotes(proposalId)` | Returns against, for, and abstain totals |
| `state(proposalId)` | Returns the proposal state |
| `quorum(proposalId)` | Returns the quorum requirement |
| `hasVoted(proposalId, account)` | Reports whether an account voted |
| `propose(targets, values, calldatas, description)` | Creates a proposal |
| `castVote(proposalId, support)` | Casts against, for, or abstain |
| `castVoteWithReason(proposalId, support, reason)` | Casts a vote with text |
| `queue(proposalId)` | Queues a successful proposal |
| `execute(proposalId)` | Executes a queued proposal |
| `cancel(proposalId)` | Cancels an eligible proposal |

The function table documents the deployed interfaces. The Lester Labs UI
currently uses the read methods and local drafting features only.

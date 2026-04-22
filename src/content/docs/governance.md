# Governance

## Overview

Lester Labs is standardising on a Snapshot-style governance model for mainnet: voting is off-chain, community-visible, and separated from execution. The website currently supports proposal drafting and governance process guidance rather than sending on-chain proposal or vote transactions from the app.

## How it works

Project teams draft a proposal, publish it to their governance forum or community channel, and set a clear balance snapshot for voting power. Votes should then be collected through an off-chain signature flow such as Snapshot or an equivalent EIP-712 process. After the vote closes, the responsible operators publish the result and carry out the approved action through the correct execution path, such as a multisig, timelock, or manual operator transaction.

Dedicated Snapshot/IPFS submission from the Lester Labs UI is planned for a future release. Until then, the governance surface intentionally avoids placeholder on-chain voting actions.

## Step-by-step guide

**Creating a proposal:**
1. Open Governance on Lester Labs and draft the proposal copy
2. Define the exact action being voted on
3. Set a voting window and a public snapshot reference
4. Publish the proposal in your Snapshot space, forum, or governance channel
5. Share supporting discussion links and the intended execution plan
6. Open the vote in your chosen off-chain signing tool

**Voting:**
1. Review the published proposal and linked discussion
2. Confirm the snapshot reference and voting window
3. Sign your vote off-chain
4. Wait for the final tally and the project’s follow-up execution post

**Note:** Voting weight should come from the project token specified in the proposal space, not from zkLTC unless the proposal explicitly says so.

## Parameters

| Field | Description | Constraints |
|---|---|---|
| Title | Proposal headline | 1–100 characters |
| Description | Full proposal text | Markdown supported |
| Voting Options | Choices available to voters | Usually For / Against / Abstain |
| Voting Window | When voting opens and closes | Must be fixed before publishing |
| Snapshot Reference | Block or timestamp used for voting power | Must be public and verifiable |
| Execution Notes | What happens if the vote passes | Should name the responsible executor |

## Fee structure

| Fee | Amount |
|---|---|
| Proposal drafting on Lester Labs | Free |
| Voting | Free in Snapshot-style flows (wallet signature, no vote gas) |

## Smart contract

- **Operating model:** Snapshot-style off-chain voting
- **On-chain proposal/vote submission from this UI:** Disabled by design
- **Execution:** Separate multisig, timelock, or manual action after the vote closes

**Key technical components:**
- `EIP-712` — typed structured data signing standard used by Snapshot-style voting flows
- Snapshot reference — determines token balances for vote weighting
- Public execution follow-up — proves how the passed result was carried out

## Sources

- [Snapshot](https://github.com/snapshot-labs/snapshot-strategies)

## Security

Keeping proposal publication and vote signing off-chain reduces the risk of the governance UI accidentally executing live protocol actions. The snapshot mechanism prevents last-minute balance changes from altering the intended voting weight, and the separate execution step creates a clear review point before any treasury or protocol change is carried out.

**Important:** Off-chain governance results are not automatically enforced on-chain. Project teams are responsible for publishing the result and then executing it transparently through the correct operational path.

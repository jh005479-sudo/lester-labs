# Governance

## Overview

The Governance tool enables project communities to create proposals and vote using their token holdings — entirely off-chain and gas-free. Based on the Snapshot protocol used by hundreds of DAOs including Uniswap, Aave, and ENS. Proposals are signed with EIP-712, results are stored on IPFS, and voting costs nothing.

## How it works

Proposals are created by specifying a snapshot block — the chain block at which token balances are recorded for voting weight. This prevents last-minute token purchases from influencing outcomes. Votes are signed messages (not transactions) submitted off-chain and stored on IPFS. The tally is computed from on-chain balances at the snapshot block combined with the signed vote messages. Results are publicly verifiable by anyone.

On-chain execution (treasury integration, automatic proposal execution) is planned for a future release and will require a separate Governor contract deployment.

## Step-by-step guide

**Creating a proposal:**
1. Connect your wallet and switch to LitVM network
2. Navigate to Governance
3. Click "New Proposal"
4. Enter proposal title and description
5. Add voting options (minimum 2)
6. Set voting period start and end dates
7. Set snapshot block (defaults to current block)
8. Sign the proposal with your wallet (no gas)
9. Proposal is published to IPFS and visible immediately

**Voting:**
1. Navigate to an active proposal
2. Select your preferred option
3. Sign the vote with your wallet (no gas)
4. Your vote is recorded — weight equals your project token balance at the snapshot block

**Note:** Voting weight is determined by holdings of the specific project token configured in the proposal (not zkLTC or any other token). Each project sets the relevant token when creating their governance space.

## Parameters

**Proposal creation:**

| Field | Description | Constraints |
|---|---|---|
| Title | Proposal headline | 1–100 characters |
| Description | Full proposal text | Markdown supported |
| Voting Options | Choices available to voters | Minimum 2 |
| Start Date | When voting opens | Can be immediate or scheduled |
| End Date | When voting closes | Must be after start date |
| Snapshot Block | Block number for balance snapshot | Defaults to current block |

## Fee structure

| Fee | Amount |
|---|---|
| Proposal creation | Free |
| Voting | Free (off-chain signature, no gas) |

## Smart contract

- **Forked from:** Snapshot (off-chain protocol, EIP-712 signing)
- **On-chain contract address:** N/A (off-chain protocol)
- **IPFS storage:** Proposals and votes stored on IPFS

**Key technical components:**
- `EIP-712` — typed structured data signing standard used for vote signatures
- `IPFS` — decentralised storage for proposal content and vote records
- Token balance at snapshot block — determines each voter's weight

## Security

Based on the Snapshot protocol, the dominant off-chain governance standard used by the largest DAOs in DeFi. Because votes are off-chain signatures rather than transactions, there is no smart contract risk associated with the voting process itself. The snapshot block mechanism prevents vote manipulation via flash loans or last-minute token purchases. Results are publicly verifiable — anyone can independently compute the tally from the IPFS vote records and on-chain token balances.

**Important:** Off-chain governance results are not automatically enforced on-chain. Project teams are responsible for executing the outcome of passed proposals. On-chain execution via treasury contract is planned for a future release.

# The Ledger

## Overview

The Ledger is a permanent, censorship-resistant message board etched directly into the LitVM blockchain. Every message is stored in Ethereum calldata — immutable, permissionless, and impossible to delete or alter. No account required. No content moderation. No platform risk.

It's a social layer that runs on smart contract infrastructure: post a message by calling the `post()` function with your LTC, and it lives forever in the chain history.

**Contract:** `0xa37fF4bAb59A5F861B48527A946C433dc1Ee8079`
**Network:** LitVM testnet (chain ID 4441)
**Fee:** 0.01 LTC per message

## How it works

The Ledger uses transaction calldata to store messages. When you call `post(message)`, the bytes of your message are embedded directly in the transaction input data — which is permanently recorded by LitVM validators. The message is then decoded and displayed in the feed at [lester-labs.com/ledger](/ledger).

The smart contract emits a `MessagePosted` event on every call, which the frontend subscribes to in real-time via WebSocket.

## What makes it different

Unlike traditional social platforms:
- **No account** — post with any wallet
- **No server** — data lives in blockchain state
- **No deletion** — nothing can be removed once posted
- **No moderation** — the protocol doesn't filter content
- **No token required** — pay in native LTC directly

## Step-by-step guide

1. Connect your wallet and switch to LitVM network
2. Navigate to [lester-labs.com/ledger](/ledger)
3. Type your message (max 1,024 characters)
4. Review the fee (0.01 LTC) — shown in the composer
5. Click **Post to Ledger**
6. Confirm in your wallet
7. Your message appears in the feed — confirmed on-chain

## Reading messages

You don't need a wallet to read The Ledger. Simply visit [lester-labs.com/ledger](/ledger) — the feed loads publicly via LitVM RPC. Each message card shows:
- The wallet address that posted it
- The block number and transaction hash
- The message content
- A link to view the raw transaction on the block explorer

## Real-time updates

The feed subscribes to `MessagePosted` events via LitVM's WebSocket endpoint, so new messages appear instantly without refreshing the page.

## FAQ

**Can I edit or delete a message?**
No. Once confirmed, a message is permanent. Choose your words carefully.

**Is there content filtering?**
The protocol does not filter messages. However, Lester Labs may apply off-chain moderation on the frontend UI at its discretion.

**What's the fee for?**
The fee (0.01 LTC) prevents spam and is split 50/50 between the protocol treasury and a burn mechanism.

**Can I post any content?**
The message bytes are limited to 1,024 bytes per call. Any UTF-8 content is valid.

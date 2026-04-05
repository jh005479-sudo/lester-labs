This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Known Limitations

### Disperse.sol — ETH Recipients

The `Disperse.sol` contract uses `.transfer()` for ETH sends, which enforces a 2300 gas stipend.
This is intentional as it provides implicit reentrancy protection inherited from the original banteg deployment.

**Limitation:** Contract wallet recipients (e.g. Gnosis Safe, smart contract addresses) that require
>2300 gas in their fallback function will cause the entire ETH disperse transaction to revert.

**Recommendation:** Only use the ETH airdrop feature to send to EOA (Externally Owned Account) wallets —
standard MetaMask, WalletConnect, or hardware wallet addresses. Do not attempt to disperse ETH directly
to multisig contracts or smart contract addresses.

Token (ERC-20) dispersal is not affected by this limitation.

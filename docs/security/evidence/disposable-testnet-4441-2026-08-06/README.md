# Disposable LiteForge deployment evidence — 2026-08-06

These are exact, post-execution mirrors of the external build attestation and
deployment manifest for the authorised valueless `testnet-immutable-disposable`
run on LitVM LiteForge chain 4441.

These files were originally deployment-only evidence, not production or public-
frontend activation evidence. On 2026-08-11 the exact immutable stack was
incorporated into the separately verified `public-testnet-immutable` approval
package and cutover evidence. It remains forbidden for real-value production.
The disclosed signer can spend the valueless test treasury and race its future
nonces, but cannot alter the already deployed contracts. All administration and
governance voting power is frozen at the verified
`0x0000000000000000000000000000000000000001` ECRECOVER precompile.

- Attested/deployed source commit:
  `abcf1b75ee7945f557163dce11485555da63a5b6`
- Build attestation SHA-256:
  `22dadde5cb86d7e601aaba5c45beb20646a365031208c72b77bb5443f56141be`
- Deployment manifest SHA-256:
  `ab5b035f537ee29f354ac3c6ef08c8c19f726058e8e776bf65ea4a950528a2eb`
- Manifest verification block: `37470382`
- [Independent credential-free verifier output](independent-verifier-output.txt)
  observed at block `37470947`; SHA-256:
  `1c39a1c6d85ed7e5acaaf62244a46cbab560f152bc83f84f945bec98ceed849d`
- [Final runtime-hash snapshot](final-runtime-hash-snapshot.json) observed at
  block `37472534`; SHA-256:
  `a14fa5b03ac021c6b1147f4cef5eaaf51b8fb81cabdf146387723ed0b8187511`

The evidence-copy commit necessarily follows the attested source commit. To
repeat the strict verifier, use a clean checkout of the attested commit, the
exact Node/Hardhat toolchain bound by the attestation, and independently supply
the attestation and manifest digests above. Never substitute these public-
testnet addresses into a production activation package. See
`../public-testnet-4441-cutover-2026-08-11/` for the later two-RPC live
verification, exact analytics cutover, and public-testnet approval scope.

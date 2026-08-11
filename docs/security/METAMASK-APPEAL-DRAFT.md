# MetaMask Classification Review Draft

Status: **NOT READY TO SUBMIT**

This draft is deliberately fail-closed. Do not submit it, claim a false
positive, or request removal until every release prerequisite below is checked
and the placeholders are replaced with public, redacted evidence references.
Never include a private key, seed phrase, cookie, token, authenticated header,
unredacted provider log, or complete wallet trace.

MetaMask's published guidance directs a site owner who believes a warning is
incorrect to open a case in the `MetaMask/eth-phishing-detect` repository. Use
the current process linked from:

- https://support.metamask.io/stay-safe/safety-in-web3/deceptive-site-ahead-when-trying-to-connect-to-a-site/
- https://github.com/MetaMask/eth-phishing-detect/issues

## Submission prerequisites

- [ ] Registrar, DNS, hosting, GitHub, email, registry, RPC, and monitoring
      recovery is `REVIEWED`, independently approved, and bound by raw digest
      into the public activation package.
- [ ] Fresh production controller and treasury Safes are distinct, their
      shared owners cannot form either threshold, and their proxy,
      implementation, owners, threshold, modules, guard, and fallback handler
      pass the exact-block verifier.
- [ ] A fresh nonce-zero gas-only EOA—not any incident or chat-disclosed
      address—deployed only the reviewed production sequence and was retired.
- [ ] The complete replacement manifest and runtime verification pass at the
      pre-deployment and current checkpoints.
- [ ] The exact-block analytics candidate, independent second-RPC repeat, and
      zero replacement counters are independently approved.
- [ ] Both immutable dependency graphs audit at zero, registry signatures pass,
      and lifecycle scripts remain denied on the release runner.
- [ ] Two clean x64 Linux builds have identical artifact inventories and the
      approved frontend manifest has two independent reviewers.
- [ ] Apex and `www` route and asset bytes match the approved manifest under
      multiple credential-free HTTP user-agent profiles from two clean network
      vantage points; separate real Chromium, Firefox, and genuine MetaMask
      sessions have also been captured and reviewed.
- [ ] DNS/TLS/headers and the production hosting deployment are re-observed;
      the stale deployment is no longer served and Content-Security-Policy is
      present.
- [ ] The clean origin publishes an explicit anti-scam statement disavowing
      unaffiliated reward, allocation, eligibility, and activity-farming
      claims. Search-engine recrawl/removal requests for stale pre-containment
      pages are recorded, and any third-party correction request is preserved
      without presenting the third party as affiliated with Lester Labs.
- [ ] MetaMask checks are repeated with a disposable testnet wallet. No
      credential request, approval substitution, recipient substitution,
      unexplained value, or unexpected chain/contract target is observed.
- [ ] An independent reviewer has checked this final text and every linked
      public artifact.

## Proposed issue

Title:

```text
Classification review request: lester-labs.com and www.lester-labs.com
```

Body:

```text
We own and operate https://lester-labs.com/ and
https://www.lester-labs.com/ on the valueless LitVM/LiteForge testnet (chain
4441). We request review of a MetaMask dapp-scanner classification affecting
these hostnames.

We treated a prior build/deployer/treasury compromise as a real incident rather
than assuming a labeling error. We quarantined legacy paid-action targets,
rotated the off-chain control plane, deployed a source-pinned replacement with
separate reviewed controller and treasury multisigs plus a single-use gas EOA,
and independently verified the resulting runtime/authority graph.

Our review did not find a credential-harvesting flow, clipboard read, hidden
recipient substitution, arbitrary-code evaluation, or unrestricted wallet
drain in the approved served frontend. We did identify a plausible heuristic in
the retired DEX: its noncanonical pair sent a direct fraction of swap inputs to
a mutable feeTo recipient. That legacy behavior and its compromised authority
are quarantined; the replacement uses canonical Uniswap V2 protocol-fee
LP-minting behavior and source-pinned separated roles.

We also found unaffiliated social posts that linked to Lester Labs while urging
users to manufacture testnet activity and claiming a confirmed future reward
or allocation. Those statements were not authored or endorsed by Lester Labs.
We removed the former speculative eligibility language from the application,
publish an explicit no-reward/no-eligibility warning, and requested correction
and recrawl of stale copies. We include the before/after evidence because this
external reputation signal may have contributed to the classification even
though it is not evidence of credential theft by the application.

The public eth-phishing-detect utility reported that neither hostname was on
its public block list at our recorded observation time. We understand that this
does not itself clear the separate dapp-scanner result.

Public evidence:
- Incident/remediation summary: [FINAL URL]
- Reviewed source commit: [40-CHARACTER COMMIT]
- Dependency/SBOM/provenance bundle: [FINAL URL + SHA-256]
- Contract deployment and authority verification: [FINAL URL + SHA-256]
- Analytics cutover and independent second-RPC proof: [FINAL URL + SHA-256]
- Approved frontend manifest: [FINAL URL + SHA-256]
- Two-vantage served apex/www parity evidence: [FINAL URLS + SHA-256]
- DNS/TLS/hosting recovery observation: [FINAL URL + SHA-256]
- Anti-scam copy and stale-search remediation record: [FINAL URL + SHA-256]

No production secret or private wallet material is included. Please re-scan
both hostnames and let us know which remaining observable behavior, if any,
supports the classification.
```

## Current evidence that must not be overstated

The 2026-08-10 public-list observation records “not blocked” for the apex and
`www`, but the separately observed dapp scanner had returned `BLOCK` with a
critical `DRAINER` factor. The live origin observation on the same date still
found the stale pre-containment Vercel deployment and no Content-Security-Policy
header. Those facts make submission premature.

The disposable testnet deployment made with the chat-disclosed signer is
functional-test evidence only. It is excluded from the production origin,
analytics continuation, safety claims, and this appeal.

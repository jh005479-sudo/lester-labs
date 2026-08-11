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
      recovery is rechecked by the account owner and recorded without secrets.
- [x] The public release is explicitly bounded to valueless LitVM LiteForge
      testnet chain `4441`; the production Safe/reviewer requirements do not
      apply to this release profile.
- [x] Every replacement administrator and all governance voting power are
      frozen at `0x0000000000000000000000000000000000000001`; the disclosed
      test treasury/gas EOA has no administrative authority.
- [x] The complete immutable replacement manifest, creation sequence, roles,
      runtimes, and child runtimes pass the source-pinned verifier.
- [x] The exact-block analytics capture, distinct-origin second-RPC repeat,
      and five zero replacement counters are digest-pinned.
- [ ] Both immutable dependency graphs audit at zero, registry signatures pass,
      and lifecycle scripts remain denied on the release runner.
- [ ] The exact approved frontend commit is built reproducibly with lifecycle
      scripts denied and the resulting artifact manifest is digest-pinned.
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
- [ ] The repository owner has checked this final text and every linked public
      artifact; a later real-value production appeal package requires the
      independent-review controls documented in the production profile.

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
than assuming a labeling error. We quarantined legacy paid-action targets and
deployed a source-pinned immutable replacement for this valueless testnet. Every
administrator and all governance voting power are frozen at the ECRECOVER
precompile address, while the disclosed test treasury/gas wallet has no admin
role. We verified the creation sequence, runtimes, roles, and initial counters
through two credential-free RPC origins.

Our review did not find a credential-harvesting flow, clipboard read, hidden
recipient substitution, arbitrary-code evaluation, or unrestricted wallet
drain in the approved served frontend. We did identify a plausible heuristic in
the retired DEX: its noncanonical pair sent a direct fraction of swap inputs to
a mutable feeTo recipient. That legacy authority is quarantined. The immutable
testnet replacement transparently retains the same Lester-specific economics:
0.20% of measured input goes to the disclosed valueless test treasury and about
0.10% remains in-pool. Crucially, its feeToSetter is permanently frozen, so the
recipient cannot be redirected. We publish this noncanonical behavior because
the extra transfer may resemble a transaction-scanner drainer heuristic.

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

The immutable testnet deployment made with the disclosed valueless signer is
now included only in the bounded `public-testnet-immutable` release and appeal
evidence. It is explicitly excluded from any real-value production claim. The
disclosed wallet can spend test gas but has no authority over the already
deployed contracts.

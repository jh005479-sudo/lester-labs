# MetaMask Classification Review Draft

Status: **READY FOR OWNER REVIEW; EXTENSION RETEST STILL OPEN**

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
- [x] Both immutable dependency graphs audit at zero, registry signatures pass,
      and lifecycle scripts remain denied on the release runner.
- [x] Exact commit `3e70876ed6e5e2b987ef1bb9d6990ab87eda7335`
      was built with `npm ci --ignore-scripts`, zero audit findings, and no
      existing Vercel build cache. The exact deployment and served-route
      digest evidence are pinned.
- [x] All 34 reviewed routes match byte-for-byte between `www` and the
      production Vercel alias under desktop, mobile, and scanner profiles (204
      origin/route/profile checks), with the same deployment ID and policy
      headers and no response cookies.
- [ ] The protected two-network-vantage workflow and separate genuine Chrome,
      Firefox, and MetaMask-extension sessions remain unavailable in this
      workspace. Do not describe the one-vantage evidence as independent
      two-vantage evidence.
- [x] DNS/TLS/headers and the production hosting deployment were re-observed;
      the stale deployment is no longer served and Content-Security-Policy is
      present.
- [x] The clean origin publishes explicit anti-scam and no-reward language and
      disavows unaffiliated reward, allocation, eligibility, and
      activity-farming claims.
- [ ] Search-engine recrawl/removal requests and any third-party correction
      requests still require the account owner’s authenticated sessions.
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
We removed the former speculative eligibility language from the application
and publish an explicit no-reward/no-eligibility warning. Authenticated
third-party correction and search recrawl requests remain pending with the
account owner. We include the before/after evidence because this
external reputation signal may have contributed to the classification even
though it is not evidence of credential theft by the application.

The public eth-phishing-detect utility reported that neither hostname was on
its public block list at our recorded observation time. We understand that this
does not itself clear the separate dapp-scanner result.

Public evidence:
- Incident/remediation summary: https://github.com/jh005479-sudo/lester-labs/blob/main/docs/security/POST-COMPROMISE-DEPLOYMENT-EVIDENCE.md
- Reviewed source commit: https://github.com/jh005479-sudo/lester-labs/commit/3e70876ed6e5e2b987ef1bb9d6990ab87eda7335
- Dependency/SBOM/provenance documentation: https://github.com/jh005479-sudo/lester-labs/tree/main/docs/security
- Contract deployment manifest: https://github.com/jh005479-sudo/lester-labs/blob/main/docs/security/evidence/disposable-testnet-4441-2026-08-06/deployment-manifest.json (raw SHA-256 `ab5b035f537ee29f354ac3c6ef08c8c19f726058e8e776bf65ea4a950528a2eb`)
- Analytics cutover and second-RPC proof: https://github.com/jh005479-sudo/lester-labs/tree/main/docs/security/evidence/public-testnet-4441-cutover-2026-08-11
- Frontend production cutover evidence: https://github.com/jh005479-sudo/lester-labs/blob/main/docs/security/evidence/frontend-production-cutover-2026-08-11.json
- Served-route digest evidence: https://github.com/jh005479-sudo/lester-labs/blob/main/docs/security/evidence/frontend-production-route-digests-2026-08-11.json (raw SHA-256 `76bb76a143bf005196107da00280fd457eae1692959abecc3736e322b62e6b2d`)
- Public security and anti-scam disclosure: https://www.lester-labs.com/security

No production secret or private wallet material is included. Please re-scan
both hostnames and let us know which remaining observable behavior, if any,
supports the classification.
```

## Current evidence that must not be overstated

The 2026-08-10 public-list observation recorded “not blocked” for the apex and
`www`, but the separately observed dapp scanner had returned `BLOCK` with a
critical `DRAINER` factor. The live origin observation on that date still found
the stale pre-containment Vercel deployment and no Content-Security-Policy
header. Those facts made submission premature; the 2026-08-11 cutover evidence
now records the cacheless replacement deployment and policy headers without
retroactively claiming that the old observation was clean.

The immutable testnet deployment made with the disclosed valueless signer is
included only in the bounded `public-testnet-immutable` release and appeal
evidence. It is explicitly excluded from any real-value production claim. The
disclosed wallet can spend test gas but has no authority over the already
deployed contracts. The cacheless deployment
`dpl_BpJHwiNjru7nj2hBsuDPSi8oKtdn` is now current on `www`; the apex redirects
to it. The public list utility returned “not blocked” for both hostnames on
2026-08-11, but the separate genuine MetaMask-extension/dapp-scanner retest is
still open because Chrome control was unavailable in this workspace.

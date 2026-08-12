# Frontend release provenance and immutable promotion

This control is deliberately fail-closed. It can produce a reviewed, signed,
reproducible standalone frontend release, but it cannot authorize a production
promotion until the repository and hosting-account controls in this document
have been configured and evidenced by the account owner.

## What is source-enforced

`frontend-release-attestation.yml` accepts only an exact lowercase commit from
protected `main`. It builds twice on x64 Linux with the digest-pinned image
`docker.io/library/node:24.18.0-bookworm@sha256:4e9cb555d708e0829c9d93e5eeae9dfab0617b832ca436a690680e0fca735ef5`
(Node 24.18.0, npm 11.16.0). Each build has an independently created
`npm ci --ignore-scripts` tree. Source and dependencies are read-only during
tests and builds, build networking is disabled, the Git worktree must remain
clean, and every tracked source file is hashed.

The pinned `npm run build` command selects Next's bundled webpack path
explicitly. A clean script-disabled install showed the default Turbopack path
attempting to resolve an undeclared `@vercel/turbopack/postcss` module; the
release does not add or download that undeclared build dependency and does not
enable lifecycle scripts to repair the tool dynamically.

The workflow then:

1. rejects build symlinks, special files, unsafe paths, oversized objects, and
   non-reproducible output;
2. creates Next.js `output: standalone` payloads independently from both builds;
3. creates deterministic tar archives and requires byte-for-byte equality;
4. starts the standalone payload without the source tree or an external
   `node_modules`, and snapshots every reviewed page from that payload;
5. recomputes the payload and archive from a fresh checkout;
6. binds the source tree, SBOM, security policy, complete artifact inventory,
   public URL inventory, embedded network origins, page snapshots, and
   deployable archive to one candidate manifest; and
7. signs the candidate, SBOM, reproducibility result, deployable archive, and
   payload inventory with GitHub/Sigstore provenance.

The build job cannot approve its own result. Two later jobs run only after the
candidate exists. They use separate protected environments:

- `frontend-release-source-security`
- `frontend-release-operations`

Each environment job emits and signs a different role-bound approval envelope.
Both envelopes include the exact candidate digest, candidate-provenance digest,
source commit, workflow run, protected environment, and role. The operations
job cryptographically verifies the candidate and first approval, creates the
second approval, assembles an `APPROVED` package, and signs the final approved
manifest. Plain reviewer names in editable JSON are not treated as approval.

## Required GitHub owner configuration

These controls are external to the repository and must be configured and
captured before the workflow is considered authoritative:

- Protect `main`; require signed commits where operationally practical, two
  approving reviews, current required checks, conversation resolution, and no
  force pushes or deletion.
- Add CODEOWNERS protection for `package.json`, `package-lock.json`, `.npmrc`,
  `next.config.ts`, `src/config/frontendReleasePolicy.json`, security scripts,
  workflows, Docker/deployment files, and release evidence schemas.
- Give the two release environments distinct required-reviewer groups. A person
  must not satisfy both roles. Disable administrator bypass and self-review.
- Limit workflow modification and manual dispatch to the reviewed release team.
- Retain the workflow run, environment-approval history, audit-log export, and
  the 90-day approved evidence artifact together.
- Enable secret scanning, dependency review, CodeQL/static analysis, and alerts
  for workflow or environment-rule changes.

The workflow records the dispatcher as `requestedBy`; GitHub's protected
environment audit log is the authority for the human approver identity.

## Complete route and resource coverage

`frontendReleasePolicy.json` contains an exact mapping for every tracked
`src/app/**/page.*` and `src/app/**/route.*`. It separately enumerates shared
Next execution surfaces such as layouts, templates, and generated metadata.
Release creation compares both maps with the tracked source tree and fails on a
new, deleted, or renamed surface until its probe or shared-source review is
recorded. Proxy, middleware, instrumentation, legacy Pages Router, and server
action (`use server`) execution surfaces are rejected rather than silently
treated as covered. The current policy has 32 exact page probes, three
live-JSON API probes (including both explorer branches), the generated sitemap,
and one additional public `security.txt` route.

For each exact page, local capture and served parity bind response bytes,
content type, security headers, third-party origins, active-resource origins,
and every same-origin active resource. Quoted and unquoted `src`, `href`,
`poster`, `srcset`, and active `link rel` attributes are covered. Every
same-origin script, stylesheet, preload, image, media object, icon, and manifest
must resolve to the reviewed public inventory. The HTML scanner deliberately
fails closed on ambiguous active markup, including entity-encoded and
slash-separated attributes, but it is not a browser DOM or JavaScript engine.
Served parity fetches every inventoried public/static object using three
credential-free HTTP user-agent strings modelled on Chromium, Firefox, and
MetaMask Mobile, with cookies and authorization omitted.

The dynamic APIs are not falsely described as byte-static. Their bodies can
change while blocks and counters advance. Instead, both apex and `www` must
return reviewed bounded schemas, security headers, types, limits, and internally
reconciled analytics totals under all three HTTP profiles. Each observed body
hash is still retained in the evidence.

Finally, executable/textual build artifacts are scanned for absolute HTTP(S)/WSS
origins. A new embedded origin fails the build until explicitly reviewed in the
policy. This is a lexical defense and does not replace manual source review or
runtime network monitoring.

Framework and dependency artifacts can also contain inert documentation,
standards, example, or source-map URLs that are not network destinations used by
the application. Those strings are not granted a package-wide or hostname-wide
exception. `src/config/reviewedEmbeddedOriginNoise.json` binds the complete set
of reviewed observations to the SHA-256 of every tracked source file except that
review file itself, and each observation to one exact artifact path and exact
sorted origin set. Excluding only the review file avoids a self-referential
digest while still making any application, dependency lock, build, CI,
documentation, or contract source change invalidate the whole review. An
artifact path move or new origin also fails the release. Generated bundle hashes
remain recorded in the signed artifact inventory; they are deliberately not used
as repository-pinned inputs because the reviewed source commit is embedded
during the build. For Next static JavaScript and CSS only, the final 16-character
content-hash filename suffix is represented by the literal `{content-hash}`
marker; the directory, logical chunk name, extension, exact origin set, and whole
tracked-source digest remain exact. No marker or wildcard is accepted elsewhere.
The review file is itself source material in the signed candidate and must be
regenerated and manually reviewed after any other tracked-file change.

## Independent post-promotion evidence

`frontend-served-parity.yml` requires two separately administered, protected,
ephemeral x64 Linux runners with these fixed labels:

- `lester-vantage-eu`
- `lester-vantage-us`

They must be hosted in different accounts or trust domains and use different
egress networks. Each runner needs only Docker, GitHub CLI, and Node 24.18.0; it
must contain no wallet, registrar, DNS, hosting, deployment, or production
credentials. Each job downloads the approved release by exact workflow run,
cryptographically verifies the candidate, approvals, final manifest, and
deployable archive, probes apex and `www`, and signs its evidence. A GitHub-hosted
comparison job verifies both signatures, requires the fixed vantage identities
to agree on the served release digest, and signs the comparison. Merely changing
two `vantageId` strings is not release evidence.

This proves credential-free HTTP response parity from those egress points. It
does not prove browser execution semantics or rule out selective serving based
on TLS fingerprint, richer request headers, cookies, extension state, or
JavaScript context. Before appeal, separately capture real digest-pinned
Chromium and Firefox sessions plus a genuine MetaMask session, including a
redacted network trace and the exact browser/extension versions.

## Hosting containment that requires the account owner

Before any preview or production deployment, the owner must review and record
the exact provider settings and audit events:

- confirm that Git-triggered production deployment is disabled in the recovered
  Vercel account; `vercel.json` also sets `git.deploymentEnabled` to `false` as
  a repository-side backstop;
- remove and rotate deployment hooks, API tokens, team tokens, and stale OAuth
  grants created before the compromise;
- review Vercel project/team members, GitHub integration authorization, ignored
  build settings, root/output directory, environment variables, domains, and
  recent deployment/audit history;
- rotate registrar, DNS, GitHub, hosting, and email recovery credentials; require
  phishing-resistant MFA; and remove unknown sessions/passkeys/SSH keys;
- require protected promotion approval and record the previous immutable
  production deployment ID plus its reviewed safety classification. A prior ID
  is not a rollback target unless signed containment evidence makes it eligible.

Export the raw provider settings and audit records, hash them, and attach them to
the control-plane recovery evidence. A repository assertion that automatic
deployment is disabled is not sufficient.

## Immutable deployment and the Vercel boundary

The signed `frontend-standalone.tar` is a complete Node standalone payload. A
compatible container/runtime can extract it into a new empty directory and run
`node server.js` with Node 24.18.0, without installing dependencies or rebuilding.
The archive SHA-256 in `approved-manifest.json` is the deployment identity.

The current production host is Vercel. A Next standalone tar is not, by itself,
a reviewed Vercel Build Output API (`.vercel/output`) artifact. The repository
now implements the provider-native container path with the dependency-free
`scripts/security/vercel-rest-release.mjs` adapter. It uploads the exact signed
tar beside a fixed `Dockerfile.vercel` that uses the reviewed Node image digest,
adds only that tar, runs as `node`, and starts `node server.js`.

The public-beta provider boundary remains fail-closed: every exact source-upload
digest and project-settings digest must first pass
`vercel-provider-canary.yml` in a distinct disposable recovered project. That
canary stages, probes, promotes the same ID, probes again, rolls back to the exact
prior ID, confirms it is current and `READY`, and deletes only the exact canary
deployment. Production staging refuses absent, unsigned, stale, or byte-different
canary evidence. Canary evidence is accepted for at most six hours and its age
is checked again immediately before the promotion mutation.

No Vercel package or dependency has been added for this work. Provider tokens
exist only in distinct protected canary, staging, stage-cleanup, promotion,
promotion-recovery, automatic-reconciliation, and manual-rollback steps;
they are not supplied to dependency installation or build steps. The complete
environment, token, OIDC Trusted Sources, run-order, evidence-retention, and
manual rollback requirements are in `VERCEL-RELEASE-OPERATIONS.md`.

No Vercel CLI is currently approved. The isolated evaluation of exact
`vercel@58.4.4` still produced 30 dependency advisories, including one critical,
so it is not a releasable provider adapter and must not be added or executed as
an exception to the repository policy.

Vercel's documented container Functions can run an HTTP server from
`Dockerfile.vercel`, but this feature is a public beta and necessarily performs
one provider build before final approval. The no-rebuild path after that build is a
[staged production deployment with automatic domain assignment disabled](https://vercel.com/docs/deployments/promoting-a-deployment),
followed by promotion of that same staged deployment. Vercel documents
[`--prebuilt` as consuming `.vercel/output`](https://vercel.com/docs/cli/deploy),
not a generic standalone tar. The adapter therefore does not pretend the tar is
`.vercel/output`, does not use a VCR shortcut, and does not treat a Vercel rebuild
as byte equivalence. It verifies the one staged provider result against every
signed route and resource before the separate final human approval.

For an approved provider-native artifact, the promotion sequence is:

1. cryptographically verify the source-security-approved manifest, tar, and
   provider-input manifest;
2. measure the tar against the account-plan upload limit and deploy it once via
   a minimal digest-pinned `Dockerfile.vercel` as a staged production container,
   with automatic domain assignment disabled;
3. run staged HTTP parity; record the immutable
   deployment ID, URL, source/container input digests, provider audit event, and
   previous production deployment ID;
4. obtain the protected operations approval over that exact staged deployment
   and its signed hold-or-safe-rollback disposition;
5. promote the same deployment ID to apex/`www` without rebuilding;
6. immediately run both signed production HTTP vantages, with each vantage
   first verifying the exact signed promotion evidence; and
7. on any mismatch, perform Vercel's routing-layer
   [instant rollback](https://vercel.com/docs/deployments/rollback-production-deployment)
   only to the exact retained emergency containment deployment whose signed
   promotion and independent two-vantage parity comparison were bound into the
   stage evidence. Preserve both the failed and rollback audit events.

The initial emergency containment uses the opposite disposition: it remains
current on parity or evidence-pipeline failure and never restores the suspect
pre-containment deployment. The supported sequence is containment to full
replacement. A future full-to-full release needs a separately defined signed
safe-baseline policy before it can use automatic rollback.

Real Chromium, Firefox, and MetaMask checks remain a separate post-promotion
gate. The workflow's three HTTP user-agent profiles do not execute JavaScript or
emulate a wallet extension.

Do not file the MetaMask false-classification appeal until the post-promotion
comparison succeeds and the public origin, DNS/TLS, contract replacement,
control-plane recovery, and deployment audit evidence all identify the same
release.

## Residual limitations

- Sigstore proves which protected workflow signed bytes; it does not prove that
  a human carefully reviewed them. Branch/environment rules and audit evidence
  provide that organizational control.
- Two network vantages and three HTTP user-agent strings reduce ordinary
  CDN/selective-serving risk but do not emulate real browsers or prove what every
  visitor receives at every instant. Continue scheduled browser monitoring.
- Dynamic API validation proves reviewed structure and invariants, not identical
  time-varying values.
- Static embedded-origin scanning can detect literals but cannot prove arbitrary
  program semantics. Manual review and browser/network observation remain
  required.
- Vercel container Functions remain a public-beta provider boundary. The
  repository now exercises that boundary through a signed disposable canary,
  exact staged-ID parity, and same-ID promotion, but these checks cannot prove
  future provider behavior or eliminate the need for retained provider audit
  evidence.

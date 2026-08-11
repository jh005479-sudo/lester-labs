# Emergency wallet-free containment release

The live Lester Labs origin still serves a stale pre-containment application.
The first hosting action after account recovery should therefore be a small
wallet-free maintenance release, not the full replacement application.

This is an incident-containment artifact. It does not activate contracts,
authorize production replacements, prove that the recovered hosting account is
safe, or make the MetaMask appeal ready.

## Artifact properties

`emergency-site/` contains exactly four static files:

- `index.html`
- `robots.txt`
- `.well-known/security.txt`
- `vercel.json`

There is no JavaScript, wallet connector, form, remotely loaded resource,
transaction target, RPC request, or dynamic server path. The page preserves the
five provisional incident-floor analytics values with an explicit disclosure
that they are action/address counts rather than unique users or an independent
audit. `Clear-Site-Data`, no-store caching, CSP, HSTS, frame, referrer,
permissions, opener, resource, MIME-sniffing, and legacy-XSS headers are
configured for every response; staged and production parity must prove that the
provider actually serves them.

Run:

```text
npm run security:emergency-containment
```

The verifier rejects extra files, symlinks, active HTML, URL-bearing attributes,
event handlers, external network URLs, changed analytics floors, changed
security headers, or an enabled Git deployment trigger.

## Protected packaging

After `main` is protected and the `frontend-emergency-containment` environment
has an account-owner required reviewer with self-review and administrator bypass
disabled, manually dispatch `emergency-containment-attestation.yml` with the
exact protected commit. It packages the four files twice through verification,
uses the digest-pinned x64 Linux Node image with no network, and signs both the
inventory and deterministic tar through GitHub/Sigstore.

The environment must be configured before first dispatch. A workflow merely
naming an environment does not prove that required reviewers exist.

## Hosting-owner sequence

Before staging:

1. Recover Vercel, registrar, DNS, GitHub, and recovery email from trusted
   sessions; rotate sessions, tokens, hooks, integrations, and unknown members.
2. Export and hash the provider settings and audit history into the redacted
   control-plane evidence bundle.
3. Confirm Git automatic deployment and all deploy hooks are disabled. The
   checked-in `git.deploymentEnabled: false` is only a backstop.
4. Disable automatic production-domain assignment and record the current
   deployment ID as the `UNSAFE_PRECONTAINMENT` prior for incident evidence. It
   is not an authorized rollback target.

Then run the exact provider path in order:

1. dispatch `emergency-containment-attestation.yml` and retain its exact
   successful run ID;
2. dispatch `vercel-provider-canary.yml` with `emergency-static`, the same
   commit, and source run ID; and
3. dispatch `vercel-production-release.yml` with both exact run IDs.

For that dispatch, set `safe_rollback_commit=none` and
`safe_rollback_run_id=none`. The signed stage disposition must be
`HOLD_PROMOTED`; any other disposition is an incident.

The production workflow stages the signed static package through the reviewed
REST adapter, verifies the unique deployment URL, pauses for approval over that
exact deployment, recorded prior ID, and hold disposition, and promotes without rebuilding. It then
rechecks apex and `www` from two independent networks. If either result or the
post-promotion evidence pipeline fails after containment becomes current, the
signed recovery path holds that exact wallet-free deployment. It must never
restore the suspect pre-containment prior. Require:

- the three intended public bodies (`index.html`, `robots.txt`, and
  `.well-known/security.txt`) to match the signed inventory; the signed
  `vercel.json` is a derivation input and `/vercel.json` must remain a 404;
- the live security headers to match `emergency-site/vercel.json`;
- no wallet prompt, signature request, transaction request, script execution,
  external network request, service worker, cached legacy route, or stale alias;
- `Clear-Site-Data` to be observed on both origins; and
- the previous unsafe deployment ID and the `HOLD_PROMOTED` recovery procedure
  to remain recorded.

The complete protected-environment variables, separate token roles, GitHub OIDC
Trusted Sources configuration, evidence inventory, and manual rollback procedure
are in `VERCEL-RELEASE-OPERATIONS.md`.

This containment page should stay live until the full replacement authority,
analytics cutover, reproducible frontend build, provider-native staged
deployment, real-browser/MetaMask checks, and public parity evidence all pass.
After the full replacement is promoted, retain the exact containment deployment
and all signed promotion/two-vantage evidence for as long as the full release
uses it as its only authorized safe rollback baseline.

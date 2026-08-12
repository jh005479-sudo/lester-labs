# Vercel canary, staged promotion, and exact rollback

The repository now contains a dependency-free Node 24 REST adapter and protected
GitHub workflows for both the wallet-free emergency site and the complete Next
standalone container. They do not make the current public deployment safe by
themselves. The recovered GitHub and Vercel accounts must first be configured
as described below, and every workflow must run from the exact reviewed commit
on protected `main`.

No Vercel CLI package is installed or executed. No dependency installation or
application build occurs in a job that receives a Vercel token.

## Provider boundary

The two reviewed provider modes are:

- `build-output-api-v3-static`: the four-file signed emergency tar is verified,
  then deterministically converted to `.vercel/output/config.json` plus three
  static public files. The source `vercel.json` is a signed input used to derive
  the exact Build Output API headers; it is not published as a public file.
- `vercel-container-public-beta`: the signed Next standalone tar is uploaded
  beside one fixed `Dockerfile.vercel`. That Dockerfile uses the reviewed Node
  image digest, adds only the signed tar, switches to the unprivileged `node`
  user, and starts `node server.js`.

Both provider paths require a new signed canary for the exact source-upload
digest and exact project settings. A prior canary for different bytes cannot be
reused. A successful canary is accepted for at most six hours, measured again at
production staging and immediately before promotion. The canary uses a distinct
disposable Vercel project, creates a staged
production deployment with automatic custom-domain assignment disabled, probes
the served bytes and headers, promotes the same deployment ID without a rebuild,
probes it again, rolls back to the exact prior ID, confirms that prior ID is
current and `READY`, and deletes only the exact canary deployment. Any third
deployment ID or uncertain routing state fails closed.

Production staging rechecks `autoAssignCustomDomains === false`, records the
current production deployment as the prior ID, binds its reviewed safety
classification and allowed recovery disposition, uploads the canary-proven
bytes, closes the preflight/upload race by re-reading the current deployment,
and requires the new deployment to be `READY/STAGED`, alias-free, and identified
by one immutable `dpl_` ID and `.vercel.app` URL.

The sole public-testnet exception is bound in code to team
`team_vnMG4DPuSLlOs9bEi7QcRjhx`, project
`prj_dbAIzvnFWLzxkt2dpphAWbserIG7`, project name `lester-labs`, and profile
`public-testnet-immutable`. Vercel may report `aliasAssigned: true` only when the
raw `READY/STAGED` alias array is exactly
`lester-labs-jh005479-8603-lester-labs.vercel.app` and
`lester-labs-lester-labs.vercel.app`. The promoted API state must retain exactly
that same pair. The immutable deployment hostname, project alias, apex, `www`,
and every other hostname are rejected from that API alias array. Apex and `www`
remain absent throughout staging and are proven separately after promotion by
credential-free served-artifact parity. `autoAssignCustomDomains === false`
remains mandatory. This exception does not apply to the
`production-separated-authority` profile.

Promotion treats a lost API response or failed confirmation as an ambiguous
provider mutation. The adapter re-reads the project and accepts only the exact
staged or prior deployment IDs. Its recovery action is fixed in the signed stage
evidence, not chosen after a failure:

- the initial emergency release is `HOLD_PROMOTED`; if the containment ID became
  current, it remains current because the pre-containment prior is classified
  `UNSAFE_PRECONTAINMENT`;
- the complete replacement is `ROLLBACK_TO_SAFE_CONTAINMENT`; its prior ID is
  eligible only when signed emergency-promotion evidence and independently
  signed two-vantage served-parity evidence identify that exact current ID.

The adapter confirms the exact selected deployment is `READY` and owns exactly
the apex and `www` aliases. It refuses to overwrite an unexpected third
deployment and reports that state as a production-routing incident.

## Required protected environments

Configure every environment to allow deployments only from protected `main`.
An environment name in YAML is not evidence that these account-side rules exist.
Export the settings and audit log after configuration and bind their hashes into
the control-plane recovery evidence.

| Environment | Long-lived secret | Required account-side policy |
| --- | --- | --- |
| `frontend-vercel-provider-canary` | `VERCEL_CANARY_TOKEN` | Required operations reviewer; no self-review or administrator bypass. Variables: `VERCEL_CANARY_TEAM_ID`, `VERCEL_CANARY_PROJECT_ID`, `VERCEL_CANARY_PROJECT_NAME`, and the distinct `VERCEL_PRODUCTION_PROJECT_ID`. |
| `frontend-vercel-staging` | Distinct `VERCEL_STAGING_TOKEN` and `VERCEL_STAGE_CLEANUP_TOKEN` | Required operations reviewer; variables `VERCEL_PRODUCTION_TEAM_ID`, `VERCEL_PRODUCTION_PROJECT_ID`, and `VERCEL_PRODUCTION_PROJECT_NAME`. The first token may create and inspect staged deployments but must not be reused for final promotion. The cleanup token is selected only after a successful stage whose signing, preservation, or upload pipeline failed; it deletes only that exact alias-free staged ID while the exact prior remains current. |
| `frontend-vercel-staged-parity` | none | Protected-main restriction. Configure the exact GitHub OIDC claims as a Vercel Trusted Source if Deployment Protection is enabled. |
| `frontend-production-promotion` | none | Final human required reviewer over the displayed staged `dpl_` ID and URL; no self-review or administrator bypass. This job signs a 30-minute approval bound to the staged ID, prior rollback ID, source/artifact hashes, and signed staged parity. |
| `frontend-vercel-promotion-executor` | `VERCEL_PROMOTION_TOKEN` and distinct `VERCEL_PROMOTION_COMPENSATION_TOKEN` | Protected-main restriction. The first token accepts only the still-valid signed final approval and promotes the exact staged ID without rebuilding. The second is exposed when promotion or any later evidence step fails and reconciles from signed stage evidence: hold emergency containment if current, or return the full frontend only to the independently proven safe-containment ID. |
| `frontend-vercel-automatic-rollback` | `VERCEL_AUTOMATIC_ROLLBACK_TOKEN` | Protected-main restriction with no wait timer or human gate. Failed independent parity invokes the same signed disposition: emergency containment stays current; the full replacement returns only to its signed safe-containment prior. |
| `frontend-vercel-rollback` | `VERCEL_ROLLBACK_TOKEN` | Required incident-commander reviewer for a manual rollback; no self-review or administrator bypass. The adapter rejects emergency evidence and permits only a signed `ROLLBACK_TO_SAFE_CONTAINMENT` disposition. |
| `frontend-vantage-eu` and `frontend-vantage-us` | none | Separately administered ephemeral x64 Linux runners and distinct egress networks. Do not place wallet, DNS, registrar, Vercel, cloud, or deployment credentials in either environment or runner image. |

Use separate, post-recovery, short-expiry credentials for canary, staging,
stage cleanup, promotion, promotion-pipeline compensation, automatic rollback, and manual rollback. Give each the narrowest
team/project permissions Vercel supports. Do not expose them as repository or
organization-wide secrets, and do not copy them into runner images, dependency
installation, build containers, logs, artifacts, or shell arguments.

## GitHub OIDC / Vercel Trusted Sources

The canary and staged-parity jobs request a short-lived GitHub OIDC token through
the runner's built-in identity endpoint, mask it immediately, and pass it only as
`x-vercel-trusted-oidc-idp-token` to the exact `.vercel.app` HTTP probe. The REST
adapter never sends that token to `api.vercel.com` and never records it in
evidence. Configure Vercel Trusted Sources to accept only the recovered
repository, protected `main`, the exact canary/production workflow, and the
corresponding protected GitHub environment claims. Do not replace this with a
long-lived Deployment Protection bypass secret.

Both OIDC-bearing jobs explicitly clear `VERCEL_TRUSTED_OIDC_TOKEN` after the
public probe, including failure paths. No later signing or artifact step should
inherit the token.

An unprotected disposable canary also works without OIDC, but it must have no
custom domains, secrets, wallet material, production environment variables, or
user traffic. The exact candidate bytes may be briefly reachable at its random
Vercel URL until the canary deletes the staged deployment.

## Release order

### Wallet-free emergency containment

1. Complete and record account recovery. Disable Vercel Git deployments,
   deployment hooks, and automatic production-domain assignment; verify the
   current production deployment ID.
2. Dispatch `emergency-containment-attestation.yml` on protected `main` with the
   exact commit. Record its successful run ID.
3. Dispatch `vercel-provider-canary.yml` with `release_kind=emergency-static`,
   that exact commit, source-attestation run ID, and an explicit upload cap.
   Record the successful canary run ID.
4. Dispatch `vercel-production-release.yml` with the same exact values plus the
   canary run ID, `safe_rollback_commit=none`, and
   `safe_rollback_run_id=none`, and `safe_rollback_parity_run_id=none`. Before
   final approval, inspect the displayed staged URL and
   download `stage-evidence.json` and `staged-parity.json`. Confirm the displayed
   staged ID and recorded prior ID are the intended pair, and that the signed
   disposition is `HOLD_PROMOTED` / `UNSAFE_PRECONTAINMENT`.
5. Approve `frontend-production-promotion`. The executor promotes only that
   staged ID. Two independent emergency vantages must then prove exact page and
   policy parity at apex and `www`. If parity or the promotion-evidence pipeline
   fails after containment became current, reconciliation deliberately holds the
   wallet-free containment ID. It never restores the suspect pre-containment
   deployment. If the prior is still current because promotion did not take
   effect, the recovery evidence records `UNSAFE_PRIOR_STILL_CURRENT` and the
   operator must treat the public origin as an active containment incident.

### Complete Next replacement

1. Complete the contract authority/redeployment, analytics cutover, reviewed
   control-plane recovery, and public replacement approval gates.
2. Dispatch `frontend-release-attestation.yml` for the exact protected commit
   and retain the successful approved-evidence run ID.
3. Dispatch `vercel-provider-canary.yml` with
   `release_kind=next-standalone-container` and that exact run ID.
4. Keep the proven emergency containment deployment retained and `READY` in
   Vercel. Dispatch `vercel-production-release.yml` with the exact commit,
   artifact run, canary run, kind, upload cap, the emergency containment source
   commit as `safe_rollback_commit`, and its successful production workflow run
   ID as `safe_rollback_run_id`. Provide the separate successful
   `emergency-served-parity.yml` dispatch as `safe_rollback_parity_run_id`. The
   production run may be red only when its signed promotion jobs succeeded and
   its signed hold-current reconciliation also succeeded; every other failed
   production-run shape is rejected. The workflow downloads the exact
   run-attempt-qualified emergency promotion and independently dispatched
   comparison artifacts and binds
   their hashes into the new stage disposition. The staged-parity job verifies every reviewed
   route, dynamic API schema, active resource, public file, response header, and
   HTTP request profile at the immutable stage URL before approval.
5. After promotion, `frontend-served-parity.yml` runs from the two fixed network
   vantages and verifies the exact signed promotion subject. Any non-success
   result invokes rollback only to the signed, independently proven containment
   ID. A failure in the promotion evidence pipeline invokes the same stage-bound
   recovery.
6. Complete separate real Chromium, Firefox, and MetaMask browser sessions and
   retain redacted network traces. HTTP user-agent profiles are not browsers.

## Manual rollback

Dispatch `vercel-production-rollback.yml` only from protected `main`. Provide
the exact current `adapter_commit`, the historical `promotion_source_commit`,
production release run ID, artifact kind, and exact promoted `dpl_` ID shown in
the signed promotion evidence. The validation job binds the historical run and
run attempt before the protected rollback job can access its token. The adapter
then accepts only a full-frontend promotion with a signed
`ROLLBACK_TO_SAFE_CONTAINMENT` disposition, requires that exact promoted ID to
still be current, requires the exact safe-containment target to be `READY`,
rejects any third ID, routes to the safe ID, and signs the observed result.

Do not manually roll back the initial emergency release through this workflow.
Its recorded prior is deliberately unsafe and the adapter rejects it.

Do not substitute a URL, mutable alias, project name, or "latest deployment" for
the explicit deployment ID.

## Evidence to retain

Retain together:

- source attestation run and signed artifact package;
- provider-canary evidence and provenance;
- stage evidence and provenance, including stage and rollback IDs;
- staged parity and provenance;
- protected-environment approval/audit events;
- promotion approval, promotion result, and both provenance bundles;
- any same-job promotion-pipeline compensation result, including unsigned raw
  rollback evidence when the GitHub attestation service itself was unavailable;
- independent production vantage evidence and comparison;
- any automatic or manual rollback evidence;
- Vercel project settings, deployment/audit events, domain history, and token
  creation/revocation records; and
- the subsequent real-browser/MetaMask evidence for the complete release.

All produced and consumed release-artifact names include the source commit,
workflow run ID, and run attempt (directly or through a validated derived name).
Do not rename, merge, or substitute artifacts from another rerun.

## Safe-baseline lifecycle

The supported production transition is currently:

```text
unsafe pre-containment -> wallet-free containment -> complete frontend
```

Retain the exact wallet-free containment deployment, its promotion evidence,
promotion provenance, two vantage subjects, comparison evidence, and comparison
provenance for as long as any complete-frontend promotion names it as the safe
rollback target. Do not delete that deployment under ordinary Vercel retention
or cleanup policies.

A later complete-frontend-to-complete-frontend upgrade is not yet authorized by
this policy. Before using that path, define and implement an equivalent signed
safe-baseline classification for a prior full release; do not reuse the current
emergency-only proof rule by assumption.

## Reviewed GitHub Actions

The release chain uses immutable full-SHA pins. The release-path review recorded:

| Action | Exact reviewed release | Publication date | Trust and permission note |
| --- | --- | --- | --- |
| `actions/attest-build-provenance@0f67c3f4856b2e3261c31976d6725780e5e4c373` | `v4.1.1` | 2026-06-26 | Official GitHub action; used only in jobs with `id-token: write` and `attestations: write` to sign fixed local subjects. |
| `actions/download-artifact@018cc2cf5baa6db3ef3c5f8a56943fffe632ef53` | `v6.0.0` | 2025-10-24 | Official GitHub action; artifact names and originating run IDs/attempts are validated before use. |
| `actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02` | `v4.6.2` | 2025-03-19 | Official GitHub action; uploads only explicit evidence directories with missing-file failure enabled. |

Each was older than the seven-day release hold on 2026-08-11. GitHub CLI
attestation verification is also fail-closed on exact `gh` version `2.96.0`
inside every verification shell block.

The provider canary and HTTP parity prove the reviewed bytes through the tested
provider path. They do not prove Vercel's future behavior, browser execution
semantics, reviewer diligence, runner administration, registrar/DNS integrity,
or custody of account credentials. A hard runner termination can also occur
between a provider mutation and the same-job compensation step; the signed stage
evidence and `recover-promotion` command are the incident recovery input, but an
operator must run it. Those controls remain separate release gates.

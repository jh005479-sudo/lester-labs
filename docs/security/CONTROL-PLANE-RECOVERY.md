# Production Control-Plane Recovery Gate

The checked-in recovery inventory is intentionally fail-closed at
`docs/security/evidence/production-control-plane-recovery.json`. Its current
`NOT_REVIEWED` sentinel means source, build, deployment, domain cutover, and
the MetaMask appeal must not be described as production-complete.

This gate covers provider-account recovery. It is separate from contract
authority verification, dependency review, build provenance, and served-file
parity; every gate must pass.

## What this gate can and cannot prove

The verifier makes incomplete, stale, internally inconsistent, copy-and-paste,
and trivially repeated evidence fail closed. It recomputes a checked-in
redacted bundle, binds that bundle to every reviewed claim, requires distinct
evidence records, and enforces review ordering and expiry.

JSON and SHA-256 do not authenticate a human or prove that a provider export is
truthful. A person with repository write access can fabricate both JSON files
and their hashes. The original provider exports, event IDs, account-security
screens, and revocation confirmations therefore remain outside-repository
evidence. Reviewers must inspect those originals from trusted sessions, and
the resulting commit must pass protected independent review. Treat this gate
as a source-pinned consistency and freshness control, not provider attestation.

## Account-owner workflow

Perform recovery from trusted account sessions. The factory-reset Mac was
authorised for the disposable valueless testnet exercise, but it is not the
production provenance boundary.

For GitHub, hosting, registrar/DNS, email, npm registry, RPC, and monitoring:

1. revoke or explicitly account for every active session;
2. enumerate each system-specific credential category in schema version 2;
3. rotate or revoke every credential that exists, and use
   `REVIEWED_NOT_PRESENT` only after confirming that category has no credential;
4. review access members, integrations, settings, audit logs, and historical
   changes;
5. preserve original redacted exports outside the repository and calculate
   their external evidence-bundle SHA-256;
6. create a separate reviewer evidence record for each reviewer and calculate
   a unique SHA-256 for each record;
7. resolve every residual risk rather than suppressing it; and
8. obtain approval from at least two people with distinct identities and
   distinct review roles after all seven provider reviews are complete.

Never commit tokens, keys, cookies, secret values, personal recovery data, or
unredacted provider exports. `accountReference` must begin with `redacted:` and
must contain a non-secret stable reference after that prefix.

## Executable schema version 2

A completed inventory uses `status: "REVIEWED"`, `schemaVersion: 2`, and exactly
these top-level fields:

- `caseId`, `incidentDetectedAt`, `reviewedAt`, and `reviewValidUntil`;
- `evidenceBundleSha256` for the original evidence retained outside Git;
- `redactedEvidenceBundlePath`, which must be exactly
  `production-control-plane-redacted-evidence.json`;
- `redactedEvidenceBundleSha256`, recomputed from that sibling file;
- `reviewers`; and
- `systems`.

The external bundle, checked-in redacted bundle, every provider audit log, and
every reviewer evidence record must use a nonzero lower-case `sha256:` digest.
All of those digests must be unique. Reusing one dummy digest across records is
rejected.

Each reviewer record has `identity`, `role`, `decision`, `approvedAt`, and
`evidenceSha256`. Identities and roles are compared case-insensitively and must
both be unique. The decision must be `APPROVE`.

The `systems` object contains exactly:

- `github`
- `hosting`
- `registrarDns`
- `email`
- `npmRegistry`
- `rpc`
- `monitoring`

Each system record must include its provider and redacted account reference,
review time, safe session disposition, system-specific credential disposition,
access/integration/configuration checks, unique audit-log digest, findings,
zero residual risks, and at least two known approving reviewers. It is invalid
to mark every credential category `REVIEWED_NOT_PRESENT` for a provider.

Credential dispositions are individual strings: `ROTATED`, `REVOKED`, or
`REVIEWED_NOT_PRESENT`. The required categories are deliberately explicit:

| System | Required credential categories |
| --- | --- |
| GitHub | account password/SSO, personal access tokens, SSH/signing keys, OAuth/GitHub Apps, deploy keys/hooks, Actions secrets, recovery methods |
| Hosting | account password/SSO, access tokens, OAuth integrations, deploy hooks, project/team secrets, recovery methods |
| Registrar/DNS | account password/SSO, API credentials, OAuth integrations, DNS-change credentials, domain-transfer credentials, recovery methods |
| Email | account password/SSO, active sessions, app passwords, OAuth grants, mail rules/forwarding, recovery methods |
| npm registry | account password/SSO, access tokens, automation tokens, trusted publishers, organisation integrations, recovery methods |
| RPC | account password/SSO, API keys, webhooks, allowlists, billing/team tokens, recovery methods |
| Monitoring | account password/SSO, API tokens, ingest keys, webhooks, integrations, recovery methods |

The code in `scripts/security/verify-control-plane-recovery.mjs` is the
authoritative executable schema; this document explains it but does not replace
it.

## Redacted evidence bundle

The sibling redacted bundle contains no credential values. It contains the
case ID, generation time, external-bundle digest, a canonical digest of every
claim in the recovery inventory, the seven provider audit-log digests, and the
reviewer evidence identities/digests. The verifier:

1. hashes the raw sibling file and compares `redactedEvidenceBundleSha256`;
2. recomputes a canonical claim-set digest from the recovery inventory;
3. checks that every provider audit-log digest matches; and
4. checks that every reviewer evidence record matches in order.

Create and commit both files in the same dedicated, independently reviewed
recovery change. Do not hand-edit a digest until it passes verification, and do
not use a hash of a fabricated placeholder as evidence.

The recovery inventory itself does not contain its Git commit hash because
that would be self-referential. The approved public activation payload binds
the raw recovery file; the protected frontend provenance gate binds the Git
commit and artifact separately.

## Time rules and release use

Provider reviews must occur after incident detection and no later than global
review closure. All provider reviews must finish within 24 hours of closure.
Every reviewer approval must occur after the last provider review and no later
than closure. `reviewValidUntil` must be after closure and no more than 72 hours
later.

Ordinary structural checks validate these relationships without consulting
the wall clock so historical artifacts remain inspectable. The mandatory
release check additionally rejects reviews more than five minutes in the
future or past their expiry. Consequently account owners should complete this
gate immediately before the production release, not days in advance.

Run the informational gate during ordinary CI:

```sh
node scripts/security/verify-control-plane-recovery.mjs
```

Run the mandatory release gate before any production build, deployment, alias
change, or appeal:

```sh
node scripts/security/verify-control-plane-recovery.mjs --require-reviewed
```

The second command is expected to fail while the sentinel remains checked in.
Do not weaken it to make a release workflow pass.

The production frontend exporter and the complete approved-package verifier
also invoke this same `--require-reviewed` freshness behavior. Stale evidence
therefore cannot mint a new approved package or pass the standalone public
replacement gate, even before the production build repeats the check.

## Current GitHub observation

The read-only snapshot in
`evidence/github-control-plane-observation-2026-08-10.json` found secret
scanning and push protection enabled, no open secret-scanning alert, and no
repository-visible deploy key, webhook, secret, variable, or pending
invitation. It also found no branch protection/ruleset, no independent
collaborator, unprotected Preview/Production environments, unrestricted Action
selection without platform-enforced SHA pinning, Dependabot disabled, no
CodeQL analysis, and one stale external pull request requiring review.

That snapshot is narrow and not approval. It cannot establish login sessions,
deleted or historical settings, PATs, OAuth grants, installed apps, recovery
methods, signing/authentication keys, or provider-side hosting ownership. Those
remain explicit account-owner checks.

## Current Vercel observation and containment

The redacted authenticated-dashboard snapshot in
`evidence/vercel-control-plane-observation-2026-08-11.json` records the hosting
state that was visible during this recovery turn. The project Git integration
was disconnected, all 23 legacy project environment-variable entries were
removed, two non-current browser sessions were revoked, and the Vercel CLI
OAuth application was disconnected. No deploy hook or project webhook remained
visible, and the existing production deployment and domain aliases were not
changed by those containment actions. Automatic production-domain assignment
was subsequently disabled and re-read as disabled after saving, so future
production builds require an explicit promotion before taking the custom domains.

The observation is deliberately not marked as provider recovery approval. The
account still had no active account-level two-factor authentication or passkey,
the current recovery browser session remained active, and global team token
revocation could affect unrelated projects. The account owner must enrol MFA,
review recovery methods and global credentials, and coordinate any team-wide
revocation. The current rollback deployment ID must still be independently
recorded before the provider adapter may stage either the emergency or full artifact.

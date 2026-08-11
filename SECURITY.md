# Security Policy

Lester Labs is wallet-connected software and includes contracts that can move assets. Treat unexpected transaction prompts, approval requests, signer changes, deployment mismatches, and domain warnings as security incidents.

## Supported versions

| Surface | Supported version |
| --- | --- |
| Website | Recovery/read-only behavior only while the public security status reports containment |
| Contracts | No legacy Lester deployment is supported for new paid writes; only source-pinned permissionless recovery actions are exposed during containment |
| Older commits, preview deployments, forks, and undeclared addresses | Unsupported |

Replacement support begins only after the reviewed source, clean build attestation,
deployed bytecode/authority inventory, and served-artifact parity are published.
Support status does not imply that the software has been independently audited.
Verify the chain ID, target address, function, value, and decoded calldata before signing.

## Report a vulnerability privately

Use [GitHub's private vulnerability reporting form](https://github.com/jh005479-sudo/lester-labs/security/advisories/new). Do not put an exploit, credential, seed phrase, private key, raw authenticated request, or unredacted wallet trace in a public issue.

Include, where available:

- the affected URL, commit, deployment ID, chain ID, contract address, and transaction hash;
- reproducible steps and the security impact;
- the wallet and browser versions, exact warning text, and UTC timestamp;
- redacted network or console evidence; and
- whether funds, credentials, deployment access, DNS, or signing authority may still be at risk.

Never send a private key or recovery phrase. A maintainer will not ask for one. Use a new disposable wallet for reproduction and fund it only with the minimum testnet gas required.

## Response targets

These are operational targets, not a guarantee:

- acknowledge a credible report within three business days;
- begin containment immediately for active credential, deployment, DNS, or fund-loss risk;
- provide a status update within seven business days; and
- coordinate disclosure after affected users can reasonably remediate.

## Dependency and build policy

- Direct npm dependencies and the npm package manager are pinned to exact versions.
- Dependency versions must observe a seven-day release hold unless a documented, explicitly approved security exception is safer than waiting.
- Dependency lifecycle scripts are disabled. No exception may be executed without exact-version review and explicit human approval in an isolated, credential-free environment.
- CI uses `npm ci --ignore-scripts`, verifies npm registry signatures, fails on applicable high or critical advisories, and rejects package metadata that diverges from the immutable lockfiles.
- Third-party GitHub Actions are pinned to full commit SHAs and run with least-privilege token permissions.
- Dependency updates must be isolated from feature work and must document version, release age, transitive changes, scripts, ownership, licensing, vulnerabilities, tests, and provenance.

## Post-compromise deployment requirements

After any maintainer workstation, wallet, CI credential, hosting account, DNS account, or source-control account may have been compromised:

1. Stop deployments and privileged transactions from the affected device.
2. Revoke and rotate repository, hosting, registry, DNS, RPC, WalletConnect, deployer, admin, treasury, and recovery credentials as applicable. Generate replacement controller and treasury addresses on a separately trusted device, record public addresses only, and never reuse an address whose private key was disclosed during testing or investigation. Move on-chain authority using the trusted device and verify the resulting state independently.
3. Review repository, branch protection, Actions, webhooks, deploy hooks, domains, environment variables, collaborators, SSH/GPG keys, OAuth apps, sessions, and audit logs for persistence.
4. Establish a clean build environment from trusted media. Do not copy `node_modules`, caches, shell profiles, package-manager configuration, browser profiles, wallet state, or build outputs from the affected device.
5. Rebuild an explicitly reviewed commit with immutable installs and no dependency scripts or production credentials. Preserve logs, checksums, scan results, and reviewer identities.
6. Deploy the verified artifact, bind the production alias to the expected deployment, purge stale caches and service workers, and compare the served JavaScript and headers with the reviewed artifact.
7. Verify every live contract's runtime bytecode, proxy implementation, owner/admin, treasury, permissions, and privileged call history against the approved inventory.
8. Complete the [post-compromise evidence template](docs/security/POST-COMPROMISE-DEPLOYMENT-EVIDENCE.md) before making a reputation-provider appeal.

Do not claim that a clean source review alone proves a clean historical or current deployment. Source, build, hosting, DNS, browser behavior, and on-chain state are separate evidence layers.

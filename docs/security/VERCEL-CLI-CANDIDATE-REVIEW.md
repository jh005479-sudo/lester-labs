# Rejected Vercel CLI candidate review

Review date: 2026-08-10

Decision: **REJECTED — not approved for installation, build, deployment, or
production credentials.**

This review tested whether an exact, aged Vercel CLI could safely turn the
signed standalone frontend into a provider-native `.vercel/output` artifact.
It did not change either application lockfile or add a repository dependency.
The candidate was downloaded and resolved only in a disposable, credential-free
directory with `ignore-scripts=true`.

## Candidate identity

- Package: `vercel`
- Exact version: `58.4.4`
- Purpose considered: create and deploy a Vercel Build Output API artifact and
  promote an immutable deployment
- Registry: `https://registry.npmjs.org/`
- Published: `2026-07-30T20:37:36.243Z` (older than the seven-day hold when
  reviewed)
- Repository: `https://github.com/vercel/vercel`, `packages/cli`
- Maintainer organization: Vercel; the registry publisher is GitHub Actions
  using npm trusted publishing
- Licence: Apache-2.0
- Tarball: `https://registry.npmjs.org/vercel/-/vercel-58.4.4.tgz`
- Unpacked size / files: 11,366,247 bytes / 160 files
- SHA-1: `8f3decb7e5621f2bc3477ca60b032637843a45a0`
- SHA-512: `32fd7cd3b3edc61cba7109dee7157fd9d0fe6d419846da55dec2d53d7116d75e5104de8afecb2ebcec30f1e35f746b9c147f42fa9e5c710174ed74b202f04f2d`
- Registry SRI:
  `sha512-Mv1807Ptxhy6cQne5xV/2dD+bUGYRtpV3sLVPXEW115RBN6K/ssuvOww8eNfdGucFH9C+p5ccQF07XSyAvBPLQ==`
- Registry signature: present and verified
- SLSA provenance attestation: present

The downloaded tarball matched the registry SHA-1 and SHA-512/SRI values. Its
published `package.json` has 35 direct production dependencies and 19 bundled
builder declarations. Resolution installed 279 packages; npm reported 352 total
dependency records when optional and peer packages were included. All 279
resolved packages had valid registry signatures and 66 had registry
attestations.

## Privilege and lifecycle assessment

The CLI is intentionally high privilege. Its published code can read and write
the filesystem and environment, spawn processes and build tools, read Vercel
configuration/credentials, and make authenticated network requests that create,
promote, roll back, alias, or delete hosting resources. The resolved graph also
contains native code or binaries, including `esbuild`, Rolldown, Oxc and keyring
bindings.

The `vercel` package itself has build/test scripts but no install lifecycle hook.
Its resolved `esbuild@0.27.0` dependency declares a `postinstall` script. That
script and every other dependency lifecycle script were denied; none were
executed. The CLI itself was not executed and no hosting token, wallet key,
signing key, SSH agent, cloud credential, or production environment value was
present during review.

## Vulnerability result

`npm audit` reported **30 findings: 1 critical, 17 high, 11 moderate and 1
low**. The critical path includes `tar@7.5.7` and
`GHSA-23hp-3jrh-7fpw`; other affected paths include `undici`, `js-yaml`,
`minimatch`, `path-to-regexp`, `smol-toml`, `@vercel/node`,
`@vercel/python-analysis`, and multiple framework builders. The candidate would
process source and build inputs and later hold deployment credentials, so these
are applicable supply-chain and build-runner risks rather than ignorable
production-runtime-only findings.

An additional isolated check of npm's proposed `vercel@54.17.3` alternative
still reported 30 findings (1 critical, 18 high, 10 moderate and 1 low), so that
version is also rejected. No `npm audit fix` or override was applied.

## Alternatives considered

1. Add or download this CLI and accept/suppress its advisories: rejected.
2. Upload the signed Next standalone tar as if it were `.vercel/output`:
   rejected because those formats are not equivalent.
3. Let Vercel rebuild source and claim equivalence to the signed standalone
   archive: rejected because it changes the deployable subject.
4. Use a separately reviewed provider adapter once a clean exact Vercel
   CLI/builder graph exists, generate and sign `.vercel/output`, stage a
   production deployment with automatic custom-domain assignment disabled,
   then promote that exact deployment without rebuilding: acceptable future
   path, subject to account recovery and protected approval.
5. Move to a reviewed container host that executes the signed standalone tar
   without transformation: acceptable architectural alternative, but it
   requires an explicit hosting migration decision and separate control-plane
   review.

The release remains fail-closed at the Vercel boundary. This decision must not
be bypassed by enabling scripts, accepting audit exceptions, supplying a Vercel
token to installation/build, or substituting a mutable Preview-to-Production
rebuild.

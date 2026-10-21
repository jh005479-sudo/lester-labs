# Emergency Node runtime remediation — 21 October 2026

The owner explicitly authorized immediate remediation despite the normal waiting
policy. The exception applies to the newly released Node security update only;
`.npmrc` retains the seven-day application/contract dependency hold and disabled
lifecycle scripts. The Node-only commit changed no application/contract dependency
versions or historical signed evidence. The subsequent dependency remediation is
recorded separately in `OCTOBER-APPLICATION-DEPENDENCIES.md` and
`OCTOBER-CONTRACT-DEPENDENCIES.md`.

## Exact replacement

- Node: `24.18.0` → `24.22.1`.
- Bundled npm: `11.16.0` → `11.19.1`, updated atomically in both manifests,
  CI assertions, release-source validation, runtime validation and test fixtures.
- Image: `docker.io/library/node:24.22.1-bookworm@sha256:5630d96570d4ca4a8523fda3d169d0114554d0f48293e1ae3db6be7c79b42a17`.
- Linux/amd64 manifest: `sha256:f9b3548b20b15b705b66aeecaeac7dd690c73d5e4661357aac02e60e3d38c88a`.
- Official advisory: https://nodejs.org/en/blog/vulnerability/october-2026-security-releases

The official Node archive was SHA-256 checked against published SHASUMS.
Registry manifest/config hashes and the npm metadata inside the amd64 image were
checked. Local execution uses ARM64 Node; it is not x64 protected-runner evidence.

## npm provenance

Registry metadata for npm `11.19.1` reports publication
`2026-08-26T21:47:53.323Z`, licence Artistic-2.0, engines
`^20.17.0 || >=22.9.0`, 1,943 files and 12,223,891 unpacked bytes.
It is older than seven days and compatible with the patched runtime.

Tarball integrity:
`sha512-ztsxKxt/kkIaAs+2i0GU6I+DRmUdrNasxTZKJe9TCdSjKxlhah/4r/hl5ygMD6XAg1qZ9c2TNomR4qgOydp10g==`.
Registry signatures are present; presence alone is not signature verification.
The package manager is supplied by the pinned Node distribution/image, not
installed with lifecycle hooks or an unpinned global npm bootstrap.

## Controls and release limits

Exact runtime/image validation remains fail-closed. Regression tests reject the
previous Node and npm, wrong OS/architecture and unreviewed image digests.
Keep protected approvals, archive signatures, source binding, independent builds,
fresh canary evidence, staged/served parity and rollback controls unchanged.
A new Dockerfile requires fresh evidence; do not edit old attestations.

This record documents source remediation, not an observed production update.
Current CI and release evidence must accompany promotion; no claim of a clean
production runtime follows from a repository merge alone.

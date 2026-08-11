# Pinned Safe 1.4.1 runtime provenance

Production controller and treasury authorities may use only the exact SafeL2
1.4.1 runtime recorded in
`contracts/deployment/safe-v1.4.1-runtime-provenance.json`. This is a reviewed
runtime fixture, not an installed application dependency. The verifier rejects
an otherwise Safe-compatible implementation whose caller-supplied hash merely
claims to be official source.

## Exact package review

| Field | Reviewed value |
| --- | --- |
| Package | `@safe-global/safe-contracts` |
| Exact version | `1.4.1` |
| Published | `2023-06-28T12:41:02.926Z` (well beyond the seven-day hold) |
| Registry | `https://registry.npmjs.org` |
| Repository | `https://github.com/safe-fndn/safe-smart-account` |
| Git commit / tree | `bf943f80fec5ac647159d26161446ac5d716a294` / `dbbe8faa94445342975303ff4da1471cac2052d6` |
| Licence | LGPL-3.0 |
| Published files / unpacked size | 235 / 5,625,720 bytes |
| Runtime dependencies installed | None; the package is not installed or added to either lockfile |
| Lifecycle scripts found | `prepare`, `prepack`, and `prepublish`, plus ordinary build/test/lint scripts |
| Lifecycle scripts executed | None; inspection used the exact remote tarball with scripts disabled |
| Native binaries | None required by the selected Solidity artifacts |
| Registry integrity | `sha512-fP1jewywSwsIniM04NsqPyVRFKPMAuirC3ftA/TA4X3Zc5EnwQp/UCJUU2PL/37/z/jMo8UUaJ+pnFNWmMU7dQ==` |
| Tarball SHA-512 | `7cfd637b0cb04b0b089e2334e0db2a3f255114a3cc02e8ab0b77ed03f4c0e17dd9739127c10a7f5022545363cbff7effcff8cca3c514689fa99c535698c53b75` |
| Registry signature | Present; key ID and signature are preserved in the runtime-provenance fixture |

The published metadata reports the Safe Global maintainers and no runtime
dependency field. Its development graph is old and contains loose ranges, and
its lifecycle scripts can execute Hardhat, Yarn, Husky, TypeScript, and shell
commands. That graph was deliberately not installed or run. Only the signed
package's already-produced SafeProxy and SafeL2 artifacts were extracted for
byte comparison. The selected code can access arbitrary assets when authorised
by its owner threshold, which is why exact owner, threshold, extension, and
runtime checks remain mandatory.

Alternatives considered were a custom multisig, accepting any Safe-compatible
runtime, or trusting operator-entered bytecode hashes. All were rejected. The
accepted use is limited to the exact SafeL2 artifact below, with one shared
singleton implementation for the two independent proxies and with no modules,
guard, or fallback handler.

## Reproducible artifact identity

The exact tag is a lightweight tag at the package `gitHead`; the source tree was
checked out detached at that commit. The package build-info records Solidity
`0.7.6+commit.7338295f`, optimizer disabled with 200 configured runs, and
literal source metadata. The reviewed build-info SHA-256 is
`0e26726d8b59a0a5b534b8c85d7119ce6640ed12610ca440c67c90617368bba4`.

| Artifact | Artifact SHA-256 | Runtime Keccak-256 |
| --- | --- | --- |
| `contracts/proxies/SafeProxyFactory.sol:SafeProxyFactory` | `f77ccb60e95345e6583216e82feb5430098679d62aa4aeda7388df3831476997` | `0x50c3cdc4074750a7a974204a716c999edd37482f907608d960b2b025ee0b3317` |
| `contracts/proxies/SafeProxy.sol:SafeProxy` | `b05eaeaf7278097e52a9e9b38410de2a812c23fa3622373473e73eaa19646ecd` | `0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c` |
| `contracts/SafeL2.sol:SafeL2` | `a57d54c0d757ca7fb86693480797de69c880878690b67061f6f9624e11def8bd` | `0xb1f926978a0f44a2c0ec8fe822418ae969bd8c3f18d61e5103100339894f81ff` |

The checked-in fixture contains only the public provenance fields and deployed
runtime and creation bytes needed to reproduce those hashes. The SafeProxy
creation-code Keccak-256 is
`0x1856e0ee08399d74e0ea0b03adca210aeade6f748969ac023cdcb4dd62dcaf5f`.
Unit tests hash the bytes; the production verifier independently hashes the
factory, proxy, and implementation runtimes at one exact block and derives the
chain-specific CREATE2 address from that creation code. Changing a source
label, runtime, release, or full commit cannot make a custom implementation
pass.

No package code or lifecycle hook was executed during this review, no package
was added to a manifest or lockfile, and no dependency-policy exception was
used.

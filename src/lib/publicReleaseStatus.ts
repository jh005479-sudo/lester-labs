import {
  APPROVED_PUBLIC_REPLACEMENT_PACKAGE,
  POST_COMPROMISE_GOVERNANCE_ACTIVE,
  POST_COMPROMISE_REPLACEMENTS_ACTIVE,
  PUBLIC_TESTNET_REPLACEMENT_ACTIVE,
} from '../config/contracts.ts'

export type PublicReleaseMode = 'containment' | 'approved-production' | 'approved-public-testnet'

export interface PublicReleaseStatusInput {
  replacementsActive: boolean
  governanceActive: boolean
  approvedPackagePresent: boolean
  publicTestnetRelease: boolean
}

export interface PublicReleaseStatusRow {
  area: string
  status: string
  detail: string
}

export interface PublicReleaseStatus {
  mode: PublicReleaseMode
  ordinaryWritesEnabled: boolean
  tone: 'warning' | 'success'
  banner: string
  footer: string
  metadataDescription: string
  openGraphDescription: string
  twitterDescription: string
  structuredDataDescription: string
  homepage: {
    heroTagline: string
    heroHeading: string
    heroDetail: string
    suiteSummary: string
    gettingStarted: string
    trustLabel: string
    ctaDetail: string
    ctaFinePrint: string
  }
  security: {
    metadataDescription: string
    heading: string
    introduction: string
    gatesHeading: string
    gateAStatus: string
    gateADetail: string
    gateBStatus: string
    gateBDetail: string
    gatesSummary: string
    rows: readonly PublicReleaseStatusRow[]
  }
}

const CONTAINMENT_STATUS: PublicReleaseStatus = Object.freeze({
  mode: 'containment',
  ordinaryWritesEnabled: false,
  tone: 'warning',
  banner: 'Post-compromise containment: ordinary contract writes are disabled; reviewed recovery actions only.',
  footer: 'Independent LitVM testnet software in post-compromise containment.',
  metadataDescription: 'Lester Labs is independent LitVM testnet software in post-compromise containment. Historical reads and narrow recovery paths remain available; ordinary writes are disabled pending source-pinned replacements.',
  openGraphDescription: 'Post-compromise containment, historical reads, and narrow recovery paths while ordinary writes remain disabled.',
  twitterDescription: 'Independent testnet software in post-compromise containment. No reward, allocation, affiliation, or eligibility is promised.',
  structuredDataDescription: 'Independent LitVM testnet software in post-compromise containment. Historical reads and narrow recovery paths remain available; ordinary writes are disabled.',
  homepage: Object.freeze({
    heroTagline: 'Post-compromise containment and recovery',
    heroHeading: 'Security containment active.',
    heroDetail: 'Ordinary contract writes are disabled while replacement deployments and the served build are independently verified. Read-only views and narrowly labelled legacy recovery actions remain available.',
    suiteSummary: 'Read-only discovery and narrowly authenticated recovery remain available while replacement writes are disabled.',
    gettingStarted: 'Review network setup, current containment, historical contract behavior, and the checks required before replacement writes can resume.',
    trustLabel: 'An independent project publishing containment status, source, and deployment evidence for public review.',
    ctaDetail: 'Review the containment status, source-pinned targets, and decoded transaction before connecting a disposable testnet wallet.',
    ctaFinePrint: 'Source availability and upstream standards are not an audit. Ordinary writes remain disabled until replacement deployment and served-build verification are complete.',
  }),
  security: Object.freeze({
    metadataDescription: 'Current containment, replacement-deployment, and site-reputation remediation status for Lester Labs.',
    heading: 'Post-compromise containment is active',
    introduction: 'The former build machine, deployer, and treasury authority are treated as compromised. The legacy stack is not considered safe for new paid interactions. This page reports readiness; it is not a claim that replacement deployment or the MetaMask warning has already been resolved.',
    gatesHeading: 'Two independent release gates',
    gateAStatus: 'Pending independent inputs',
    gateADetail: 'Replace and verify the deployer, controller, treasury, role graph, hosting credentials, DNS authority, and every administrative or fee-routing path. A clean website alone cannot repair compromised on-chain control.',
    gateBStatus: 'Pending clean evidence',
    gateBDetail: 'Reproduce the warning, remove misleading or unsafe interaction patterns, review source and dependencies, attest exact runtimes and frontend assets, and verify the clean production origin. Fresh keys alone cannot prove this gate.',
    gatesSummary: 'Neither gate substitutes for the other. Ordinary writes stay disabled, and a reputation appeal is submitted only after both gates pass.',
    rows: Object.freeze([
      Object.freeze({
        area: 'Application writes',
        status: 'Contained',
        detail: 'Ordinary contract writes are disabled. Only narrowly scoped, permissionless recovery paths remain available.',
      }),
      Object.freeze({
        area: 'Legacy authorities',
        status: 'Compromised · UI quarantined',
        detail: 'The legacy contracts still have compromised on-chain authority. This source blocks them as new paid-action and approval targets; that is containment, not authority recovery.',
      }),
      Object.freeze({
        area: 'Gate A — authority recovery',
        status: 'Pending independent inputs',
        detail: 'Activation requires distinct fresh controller, treasury, and one-time deployer addresses, verified role assignments, and retirement of compromised authority paths.',
      }),
      Object.freeze({
        area: 'Gate B — source and reputation',
        status: 'Pending clean evidence',
        detail: 'Reviewed source, reproducible artifacts, exact runtime and served-asset parity, hosting/account control, and warning-trigger remediation must pass independently of Gate A.',
      }),
      Object.freeze({
        area: 'Wallet connectivity',
        status: 'Restricted',
        detail: 'Injected wallets only during recovery. WalletConnect and mutable frontend contract/RPC environment overrides are disabled.',
      }),
      Object.freeze({
        area: 'Site reputation',
        status: 'Remediation in progress',
        detail: 'A MetaMask hostname warning remains under investigation. No appeal will be submitted until both independent release gates pass and the clean production deployment is rechecked.',
      }),
    ]),
  }),
})

const APPROVED_PRODUCTION_STATUS: PublicReleaseStatus = Object.freeze({
  mode: 'approved-production',
  ordinaryWritesEnabled: true,
  tone: 'success',
  banner: 'Reviewed post-compromise replacement candidate for LiteForge; production serving requires the separate frontend approval and parity gate.',
  footer: 'Independent LitVM testnet software built against a source-pinned post-compromise replacement candidate.',
  metadataDescription: 'Lester Labs is independent LitVM testnet software built against a source-pinned post-compromise replacement candidate for chain 4441.',
  openGraphDescription: 'Source-pinned LitVM testnet release candidate, bounded analytics, and authenticated legacy recovery.',
  twitterDescription: 'Independent testnet release candidate using a reviewed, source-pinned replacement. No reward, allocation, affiliation, or eligibility is promised.',
  structuredDataDescription: 'Independent LitVM testnet software built against a source-pinned post-compromise replacement candidate, with bounded reads and authenticated legacy recovery.',
  homepage: Object.freeze({
    heroTagline: 'Source-pinned post-compromise release candidate',
    heroHeading: 'Reviewed replacement candidate built.',
    heroDetail: 'Candidate writes target the source-pinned replacement deployment. Legacy contracts remain retired; verify chain 4441, target, function, recipient, and value before signing.',
    suiteSummary: 'Candidate replacement actions sit alongside bounded discovery and authenticated legacy recovery; production serving is separately gated.',
    gettingStarted: 'Review network setup, source-pinned replacement contracts, historical recovery boundaries, and both the candidate and frontend deployment evidence.',
    trustLabel: 'An independent project publishing source, deployment evidence, bounded analytics, and explicit release-gate boundaries for public review.',
    ctaDetail: 'Review the candidate status, source-pinned target, and decoded transaction before connecting a disposable testnet wallet.',
    ctaFinePrint: 'Source availability and approval records are not cryptographic signatures or an audit. Production serving requires the separate approved frontend manifest and served-artifact parity proof.',
  }),
  security: Object.freeze({
    metadataDescription: 'Reviewed post-compromise replacement candidate, legacy recovery boundaries, and the separate production-serving and site-reputation gates for Lester Labs.',
    heading: 'Reviewed post-compromise replacement candidate',
    introduction: 'This candidate targets the source-pinned replacement deployment and separated authorities. Compromised legacy contracts remain quarantined as new paid-action targets. Candidate approval does not prove that any public origin serves the reviewed bytes.',
    gatesHeading: 'Candidate approval and production-serving gate',
    gateAStatus: 'Passed for this candidate payload',
    gateADetail: 'The payload binds the reviewed authority inventory, full exact-block Safe verification, control-plane recovery file, distinct deployer/controller/treasury roles, replacement runtimes, cutover evidence, and zero starting counters.',
    gateBStatus: 'Separate protected deployment gate required',
    gateBDetail: 'A protected x64 Linux build must produce the APPROVED frontend manifest, deploy that exact artifact, and prove apex/www routes and assets byte-for-byte equivalent before this candidate may be served or used for an appeal.',
    gatesSummary: 'Candidate approval enables the source build path, not public deployment. Protected frontend approval and served parity remain mandatory and cannot be inferred from contract activation.',
    rows: Object.freeze([
      Object.freeze({
        area: 'Application writes',
        status: 'Candidate targets enabled',
        detail: 'Candidate writes are restricted to the source-pinned post-compromise deployment and central chain/runtime/target policy. The candidate is not authorized for public serving by this signal alone.',
      }),
      Object.freeze({
        area: 'Legacy authorities',
        status: 'Compromised · UI quarantined',
        detail: 'Legacy authorities remain untrusted and cannot be selected for a new paid action or approval. Authenticated permissionless recovery remains separately labelled.',
      }),
      Object.freeze({
        area: 'Gate A — authority recovery',
        status: 'Passed for candidate payload',
        detail: 'The approved payload pins separated controller, treasury, and single-use deployer identities, the fully verified production Safe facts, and the reviewed control-plane evidence digest.',
      }),
      Object.freeze({
        area: 'Gate B — source and reputation',
        status: 'Protected deployment proof required',
        detail: 'Frontend approval, release build identity, exact deployed artifacts, and served apex/www parity are external release prerequisites and are not asserted by this candidate.',
      }),
      Object.freeze({
        area: 'Wallet connectivity',
        status: 'Injected wallet · chain guarded',
        detail: 'WalletConnect and mutable contract/RPC environment overrides remain disabled. Every write is gated to source-pinned chain 4441 targets.',
      }),
      Object.freeze({
        area: 'Site reputation',
        status: 'Not inferred from candidate approval',
        detail: 'A MetaMask appeal is eligible only after the protected frontend deployment and served-parity evidence pass. External warning status is always checked and reported separately.',
      }),
    ]),
  }),
})

const APPROVED_PUBLIC_TESTNET_STATUS: PublicReleaseStatus = Object.freeze({
  mode: 'approved-public-testnet',
  ordinaryWritesEnabled: true,
  tone: 'success',
  banner: 'Lester Labs DeFi suite live on LitVM LiteForge testnet · chain 4441.',
  footer: 'A LitVM native DeFi suite, live on testnet.',
  metadataDescription: 'Create, launch, distribute, vest, lock, swap, and explore assets with Lester Labs on LitVM testnet.',
  openGraphDescription: 'A LitVM native DeFi suite for tokens, swaps, liquidity, launches, distributions, and on-chain tools.',
  twitterDescription: 'Lester Labs is a LitVM native DeFi suite, live on testnet.',
  structuredDataDescription: 'A LitVM native DeFi suite for creating, trading, launching, distributing, and managing testnet assets.',
  homepage: Object.freeze({
    heroTagline: 'Live on Testnet',
    heroHeading: 'Replacement testnet stack active.',
    heroDetail: 'Writes target the source-pinned immutable replacement contracts on LitVM chain 4441. The controller is permanently frozen; the disclosed treasury can receive only valueless test assets.',
    suiteSummary: 'Mint, launch, lock, airdrop, vest, swap and more, exclusively on LitVM',
    gettingStarted: 'Confirm LitVM chain 4441, review the exact contract target and transaction preview, and use only disposable testnet wallets and valueless test assets.',
    trustLabel: 'An independent testnet project publishing exact source, deployment, runtime, cutover, and served-build evidence for public review.',
    ctaDetail: 'Verify chain 4441, the source-pinned target, function, recipient, and value before connecting a disposable testnet wallet.',
    ctaFinePrint: 'Test assets have no represented value. Source availability and automated checks are not an audit; the MetaMask classification is tracked separately.',
  }),
  security: Object.freeze({
    metadataDescription: 'Immutable public-testnet replacement, compromise remediation, legacy recovery boundaries, and site-reputation status for Lester Labs.',
    heading: 'Immutable public-testnet replacement active',
    introduction: 'The compromised legacy stack remains quarantined for new paid actions. This release targets a separately deployed, source-pinned replacement stack whose administrative authority is permanently frozen. The disclosed wallet is not an administrator and is accepted only as a valueless test-gas and test-fee destination.',
    gatesHeading: 'Public-testnet contract and served-build evidence',
    gateAStatus: 'Passed for the bounded public-testnet model',
    gateADetail: 'All thirteen deployment transactions, receipts, exact runtimes, role bindings, zero cutover counters, immutable controller, and disclosed test treasury were checked through two distinct RPC origins. Production multisig and independent-reviewer requirements remain reserved for any real-value release.',
    gateBStatus: 'Served parity and reputation status tracked separately',
    gateBDetail: 'The release build must still be deployed through the protected frontend workflow and apex/www bytes rechecked before a MetaMask false-classification appeal is submitted.',
    gatesSummary: 'The testnet authority exception does not weaken the future production profile. Chain/runtime/target guards remain mandatory, governance writes stay disabled, and served-build parity is evidenced separately.',
    rows: Object.freeze([
      Object.freeze({
        area: 'Application writes',
        status: 'Enabled · public testnet only',
        detail: 'Writes are restricted to LitVM chain 4441 and exact source-pinned replacement targets with runtime and transaction preflight checks.',
      }),
      Object.freeze({
        area: 'Replacement authority',
        status: 'Immutable · no admin key',
        detail: 'Administrative roles point to 0x0000000000000000000000000000000000000001. No wallet can exercise them.',
      }),
      Object.freeze({
        area: 'Test treasury',
        status: 'Disclosed EOA · valueless assets only',
        detail: 'The disclosed wallet receives test fees and supplied deployment gas but has no contract administration or governance role.',
      }),
      Object.freeze({
        area: 'Legacy authorities',
        status: 'Compromised · UI quarantined',
        detail: 'Legacy authorities remain untrusted and cannot be selected for new paid actions or approvals. Authenticated permissionless recovery remains separately labelled.',
      }),
      Object.freeze({
        area: 'Governance writes',
        status: 'Disabled',
        detail: 'The replacement governance contracts are retained as deployment evidence but are intentionally unavailable to the frontend in this immutable testnet profile.',
      }),
      Object.freeze({
        area: 'Site reputation',
        status: 'Appeal follows served-parity proof',
        detail: 'The MetaMask warning remains an external classification until the remediated apex/www deployment is verified and the factual appeal is filed.',
      }),
    ]),
  }),
})

/**
 * Resolve the public release presentation from the same source-pinned signals
 * that enable ordinary writes in the release candidate. A partial activation
 * throws during import/build rather than presenting containment copy beside an
 * enabled transaction path. This model intentionally does not claim that the
 * candidate is deployed: protected frontend approval and served-artifact parity
 * remain an external prerequisite for moving the public aliases.
 */
export function getPublicReleaseStatus(input: PublicReleaseStatusInput): PublicReleaseStatus {
  const allInactive = [
    input.replacementsActive,
    input.governanceActive,
    input.approvedPackagePresent,
    input.publicTestnetRelease,
  ].every((value) => value === false)
  if (allInactive) return CONTAINMENT_STATUS
  if (
    input.replacementsActive && !input.governanceActive &&
    input.approvedPackagePresent && input.publicTestnetRelease
  ) return APPROVED_PUBLIC_TESTNET_STATUS
  if (
    input.replacementsActive && input.governanceActive &&
    input.approvedPackagePresent && !input.publicTestnetRelease
  ) return APPROVED_PRODUCTION_STATUS
  {
    throw new Error('Public release status must match the approved production or bounded public-testnet authority model.')
  }
}

export const PUBLIC_RELEASE_STATUS = getPublicReleaseStatus({
  replacementsActive: POST_COMPROMISE_REPLACEMENTS_ACTIVE,
  governanceActive: POST_COMPROMISE_GOVERNANCE_ACTIVE,
  approvedPackagePresent: Boolean(APPROVED_PUBLIC_REPLACEMENT_PACKAGE),
  publicTestnetRelease: PUBLIC_TESTNET_REPLACEMENT_ACTIVE,
})

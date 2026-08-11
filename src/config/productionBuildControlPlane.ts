import { verifyControlPlaneRecoveryEvidence } from '../../scripts/security/verify-control-plane-recovery.mjs'
import { verifyApprovedPublicReplacementPackage } from '../../scripts/security/verify-approved-public-replacement.mjs'

type RecoveryVerifier = (
  filePath?: string,
  options?: { requireReviewed?: boolean },
) => unknown

type PublicReplacementVerifier = () => { status: string }

type ProductionBuildControlPlaneOptions = {
  publicReplacementStatus: string
  releaseProfile?: string
  releaseBuildId: string | undefined
  verifyRecovery?: RecoveryVerifier
  verifyPublicReplacement?: PublicReplacementVerifier
}

export function resolveProductionReleaseBuildId(
  requestedReleaseBuildId: string | undefined,
  providerReleaseBuildId: string | undefined,
): string | undefined {
  if (
    requestedReleaseBuildId !== undefined &&
    providerReleaseBuildId !== undefined &&
    requestedReleaseBuildId !== providerReleaseBuildId
  ) {
    throw new Error('LESTER_RELEASE_BUILD_ID must match VERCEL_GIT_COMMIT_SHA when both are present.')
  }
  return providerReleaseBuildId ?? requestedReleaseBuildId
}

export function assertProductionBuildControlPlane({
  publicReplacementStatus,
  releaseProfile,
  releaseBuildId,
  verifyRecovery = verifyControlPlaneRecoveryEvidence,
  verifyPublicReplacement = verifyApprovedPublicReplacementPackage,
}: ProductionBuildControlPlaneOptions): void {
  if (publicReplacementStatus !== 'APPROVED') return
  if (releaseBuildId === undefined) {
    throw new Error(
      'An APPROVED public replacement build requires LESTER_RELEASE_BUILD_ID or VERCEL_GIT_COMMIT_SHA.',
    )
  }
  if (!/^[0-9a-f]{40}$/.test(releaseBuildId)) {
    throw new Error('An APPROVED public replacement build requires a lowercase 40-character release build ID.')
  }
  const replacement = verifyPublicReplacement()
  if (replacement.status !== 'APPROVED') {
    throw new Error('The full public replacement verifier did not return APPROVED.')
  }
  if (releaseProfile !== 'public-testnet-immutable') {
    verifyRecovery(undefined, {
      requireReviewed: true,
    })
  }
}

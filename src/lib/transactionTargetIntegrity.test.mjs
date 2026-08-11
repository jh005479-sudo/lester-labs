import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  LITVM_TESTNET_CONTRACTS,
  LITVM_CURRENT_RUNTIME_CODE_HASHES,
  LITVM_CURRENT_VESTING_CHILD_RUNTIME_CODE_HASHES,
  LITVM_LEGACY_DEX_RECOVERY_DEPLOYMENTS,
  LITVM_LEGACY_LIQUIDITY_LOCKERS,
  LITVM_LEGACY_VESTING_FACTORIES,
  POST_COMPROMISE_REPLACEMENTS_ACTIVE,
  assertNoContractTargetEnvironmentOverrides,
  isCanonicalLitvmContract,
} from '../config/contracts.ts'

const sourceRoot = fileURLToPath(new URL('../', import.meta.url))

function sourceFiles(directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...sourceFiles(path))
    if (entry.isFile() && /\.(?:ts|tsx)$/u.test(entry.name)) files.push(path)
  }
  return files
}

describe('LitVM transaction target integrity', () => {
  it('accepts canonical addresses without relying on checksum casing', () => {
    assert.equal(
      isCanonicalLitvmContract(
        LITVM_TESTNET_CONTRACTS.liquidityLocker.toLowerCase(),
        LITVM_TESTNET_CONTRACTS.liquidityLocker,
      ),
      true,
    )
  })

  it('fails closed for missing and alternate valid-looking deployments', () => {
    assert.equal(isCanonicalLitvmContract(undefined, LITVM_TESTNET_CONTRACTS.ledger), false)
    assert.equal(
      isCanonicalLitvmContract(
        '0x1111111111111111111111111111111111111111',
        LITVM_TESTNET_CONTRACTS.ledger,
      ),
      false,
    )
  })

  it('rejects stale hosting-layer contract target overrides at build time', () => {
    assert.throws(
      () => assertNoContractTargetEnvironmentOverrides({
        NEXT_PUBLIC_DISPERSE_ADDRESS: '0x1111111111111111111111111111111111111111',
      }),
      /source-pinned/i,
    )
    assert.throws(
      () => assertNoContractTargetEnvironmentOverrides({
        NEXT_PUBLIC_LITVM_RPC_URL: 'https://attacker.invalid/rpc',
      }),
      /source-pinned/i,
    )
    assert.throws(
      () => assertNoContractTargetEnvironmentOverrides({
        NEXT_PUBLIC_GOVERNOR_ADDRESS: '0x2222222222222222222222222222222222222222',
      }),
      /source-pinned/i,
    )
    assert.throws(
      () => assertNoContractTargetEnvironmentOverrides({
        NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: 'legacy-hosting-project',
      }),
      /NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID/,
    )
    assert.doesNotThrow(() => assertNoContractTargetEnvironmentOverrides({}))
  })

  it('keeps replacement paid writes globally disabled in the pre-cutover registry', () => {
    assert.equal(POST_COMPROMISE_REPLACEMENTS_ACTIVE, false)
    const contractsSource = readFileSync(new URL('../config/contracts.ts', import.meta.url), 'utf8')
    assert.match(contractsSource, /DISPOSABLE_TESTNET_FROZEN_AUTHORITY/)
    assert.match(
      contractsSource,
      /rejectedAuthorityAddresses\s*=\s*\[[\s\S]*DISPOSABLE_TESTNET_FROZEN_AUTHORITY/,
    )
  })

  it('pins exact recovery runtime hashes for every retired direct-write surface', () => {
    assert.deepEqual(LITVM_CURRENT_RUNTIME_CODE_HASHES, {
      tokenFactory: '0x5b3bb2e693021e2ab040b6bf248785eb627600bbec002e87c10e138521be1d9d',
      vestingFactory: '0x96f1c281dcb7a5a69cb007f511067ac08cf39811fc1d5b92864fb3f455ed2e73',
      liquidityLocker: '0xfa5c90c1aee9f3f2606cf1a04b3a4a742ac2950dbf09e0d2e67412d311786c8a',
      disperse: '0x0a002cb14450c22d20885e40fec35bc924e0229f91b7b359c926850b10548891',
      ledger: '0x5bfae473fddc1457d06edc1c5603f0217b0b3debdc34969abe1611b386fb4233',
      uniswapV2Factory: '0xce41e64702f625a6e52ba7d0406293e089078d3e6bdaf68d7fa8587f951453ee',
      uniswapV2Router: '0x0bd1cb8135296ff81274635a526cf4bacb32aee80ea0938899ea64294e2bba8a',
      uniswapV2Pair: '0x418843f01f93a550a3e425e6e1028f0ff8c16448fa3416c39505b9238722fcd4',
      wrappedZkLtc: '0x8c18c51fd322d08ccd34df2b97420cc87b004e738da9363d35a38cc2be761b05',
    })
    assert.deepEqual(LITVM_CURRENT_VESTING_CHILD_RUNTIME_CODE_HASHES, [
      '0x1b19aa59a319db5cb492e8d8b2c7a02e639554a3aebfcc9ebefd2bd95ebcf1f9',
      '0xc0fccea1e1285b801b4112c0c689f6c2ee42636faf92979afbe89f55b46198a9',
    ])
    assert.equal(LITVM_LEGACY_VESTING_FACTORIES[0].retiredAtBlock, 36_723_038n)
    assert.equal(LITVM_LEGACY_LIQUIDITY_LOCKERS[0].retiredAtBlock, 36_723_038n)
    assert.deepEqual(LITVM_LEGACY_DEX_RECOVERY_DEPLOYMENTS[0], {
      id: 'pre-containment-2026-08-04',
      label: 'Pre-containment Lester DEX',
      factory: LITVM_TESTNET_CONTRACTS.uniswapV2Factory,
      router: LITVM_TESTNET_CONTRACTS.uniswapV2Router,
      wrappedNative: LITVM_TESTNET_CONTRACTS.wrappedZkLtc,
      retiredAtBlock: 36_723_038n,
      factoryRuntimeCodeHash: LITVM_CURRENT_RUNTIME_CODE_HASHES.uniswapV2Factory,
      routerRuntimeCodeHash: LITVM_CURRENT_RUNTIME_CODE_HASHES.uniswapV2Router,
      wrappedNativeRuntimeCodeHash: LITVM_CURRENT_RUNTIME_CODE_HASHES.wrappedZkLtc,
      pairRuntimeCodeHash: LITVM_CURRENT_RUNTIME_CODE_HASHES.uniswapV2Pair,
    })
  })

  it('routes ordinary and recovery writes through separate central policy checks', () => {
    const hookSource = readFileSync(new URL('../hooks/useSafeWriteContract.ts', import.meta.url), 'utf8')
    assert.match(hookSource, /assertStandardFrontendWriteAllowed\(variables, connectedAddress/)
    assert.match(hookSource, /assertRecoveryFrontendWriteAllowed\(variables, connectedAddress, provenance\)/)
    assert.match(hookSource, /writeRecoveryContractAsync/)
    assert.match(hookSource, /attestRuntimeRequirements\(decision\.runtimeAttestations\)/)
    assert.match(hookSource, /attestRecoveryWriteProvenance\(variables, approvedProvenance, connectedAddress\)/)

    const policySource = readFileSync(new URL('./frontendWritePolicy.ts', import.meta.url), 'utf8')
    assert.match(policySource, /if \(!configuration\.replacementsActive\)/)
    assert.doesNotMatch(policySource, /if \(POST_COMPROMISE_REPLACEMENTS_ACTIVE\) return/)
    assert.match(policySource, /isCanonicalLitvmContract\(recipient, account\)/)
    assert.match(policySource, /Transaction proceeds must be sent to the connected wallet/)
    assert.match(policySource, /Standard frontend capability is not permitted/)
  })

  it('keeps raw wallet-write primitives confined to the central safe-write hook', () => {
    const bypasses = []
    for (const path of sourceFiles(sourceRoot)) {
      const source = readFileSync(path, 'utf8')
      const projectPath = relative(sourceRoot, path)
      if (projectPath === 'hooks/useSafeWriteContract.ts') continue
      if (
        /\buseWriteContract\b/u.test(source) ||
        /\buseWriteContracts\b/u.test(source) ||
        /\buseSendTransaction\b/u.test(source) ||
        /\buseSendCalls\b/u.test(source) ||
        /\buseDeployContract\b/u.test(source) ||
        /\buseSignMessage\b/u.test(source) ||
        /\buseSignTypedData\b/u.test(source) ||
        /\buseWalletClient\b/u.test(source) ||
        /\buseConnectorClient\b/u.test(source) ||
        /\bcreateWalletClient\b/u.test(source) ||
        /\bgetWalletClient\b/u.test(source) ||
        /\bgetConnectorClient\b/u.test(source) ||
        /\bwriteContract\s*\(/u.test(source) ||
        /\bwriteContracts(?:Async)?\s*\(/u.test(source) ||
        /\bsendCalls(?:Async)?\s*\(/u.test(source) ||
        /\bsendTransaction(?:Async)?\s*\(/u.test(source) ||
        /\bdeployContract(?:Async)?\s*\(/u.test(source) ||
        /\bsignTransaction(?:Async)?\s*\(/u.test(source) ||
        /\bsignMessage(?:Async)?\s*\(/u.test(source) ||
        /\bsignTypedData(?:Async)?\s*\(/u.test(source) ||
        /\bwindow\.ethereum\b/u.test(source) ||
        /\bglobalThis\.ethereum\b/u.test(source) ||
        /\.request\s*\(/u.test(source) ||
        /\bgetProvider\s*\(/u.test(source) ||
        /\beth_send(?:Raw)?Transaction\b/u.test(source) ||
        /\bpersonal_sign\b/u.test(source) ||
        /\beth_sign(?:Transaction|TypedData(?:_v\d)?)?\b/u.test(source) ||
        /\bwallet_(?:sendCalls|watchAsset|switchEthereumChain|addEthereumChain)\b/u.test(source)
      ) {
        bypasses.push(projectPath)
      }
    }
    assert.deepEqual(bypasses, [])
  })

  it('enumerates every user-accessible standard and recovery write call site', () => {
    const writeSites = []
    for (const path of sourceFiles(sourceRoot)) {
      const projectPath = relative(sourceRoot, path)
      if (projectPath === 'hooks/useSafeWriteContract.ts') continue
      const source = readFileSync(path, 'utf8')
      const standard = source.match(/\bwriteContractAsync\s*\(/gu)?.length ?? 0
      const recovery = source.match(/\bwriteRecoveryContractAsync\s*\(/gu)?.length ?? 0
      if (standard + recovery === 0) continue
      assert.match(source, /useSafeWriteContract\(\)/, `${projectPath} must obtain writes from the central hook`)
      writeSites.push([projectPath, standard, recovery])
    }

    writeSites.sort(([left], [right]) => left.localeCompare(right))
    assert.deepEqual(writeSites, [
      ['app/launchpad/[address]/page.tsx', 4, 6],
      ['app/launchpad/page.tsx', 1, 0],
      ['app/pool/page.tsx', 0, 3],
      ['app/swap/page.tsx', 6, 1],
      ['components/airdrop/AirdropForm.tsx', 3, 0],
      ['components/launch/TokenWizard.tsx', 1, 0],
      ['components/ledger/MessageComposer.tsx', 1, 0],
      ['components/locker/LockForm.tsx', 2, 0],
      ['components/locker/MyLocks.tsx', 0, 1],
      ['components/vesting/MySchedules.tsx', 0, 1],
      ['components/vesting/VestingForm.tsx', 2, 0],
      ['hooks/useGovernance.ts', 3, 0],
    ])
  })

  it('prohibits unguarded wallet simulations and confines connect/switch prompts', () => {
    const simulationSites = []
    const connectionSites = []
    const switchSites = []
    for (const path of sourceFiles(sourceRoot)) {
      const projectPath = relative(sourceRoot, path)
      const source = readFileSync(path, 'utf8')
      if (/\b(?:useSimulateContract|simulateContract|useEstimateGas|estimateGas|estimateContractGas|prepareTransactionRequest)\b/u.test(source)) {
        simulationSites.push(projectPath)
      }
      if (/\b(?:useConnect|connectAsync)\b/u.test(source)) connectionSites.push(projectPath)
      if (/\b(?:useSwitchChain|switchChainAsync)\b/u.test(source)) switchSites.push(projectPath)
    }

    assert.deepEqual(simulationSites, [])
    assert.deepEqual(connectionSites, ['components/shared/InjectedWalletButton.tsx'])
    assert.deepEqual(switchSites, ['hooks/useLitvmNetwork.ts'])

    const connectSource = readFileSync(new URL('../components/shared/InjectedWalletButton.tsx', import.meta.url), 'utf8')
    assert.match(connectSource, /connectAsync\(\{ connector: injectedConnector, chainId: litvm\.id \}\)/)
    assert.match(connectSource, /assertLitvmChainId\(connection\.chainId\)/)
    assert.match(connectSource, /attestLitvmWalletChain\(\{ expectedAddress: connection\.accounts\[0\] \}\)/)

    const switchSource = readFileSync(new URL('../hooks/useLitvmNetwork.ts', import.meta.url), 'utf8')
    assert.match(switchSource, /switchChainAsync\(\{ chainId: litvm\.id \}\)/)
    assert.match(switchSource, /switchedChain\.id !== litvm\.id/)
    assert.match(switchSource, /attestLitvmWalletChain\(\{ expectedAddress: address \}\)/)
  })

  it('places two fresh chain checks around every central async preflight and pins the final prompt', () => {
    const hookSource = readFileSync(new URL('../hooks/useSafeWriteContract.ts', import.meta.url), 'utf8')
    const guardSource = readFileSync(new URL('./litvmChainGuard.ts', import.meta.url), 'utf8')
    const policySource = readFileSync(new URL('./litvmChainPolicy.ts', import.meta.url), 'utf8')
    assert.equal(hookSource.match(/runGuardedLitvmWalletPrompt\(\{/gu)?.length, 2)
    assert.equal(hookSource.match(/chainId: litvm\.id/gu)?.length, 2)
    assert.equal(hookSource.match(/account: connectedAddress/gu)?.length, 2)
    assert.doesNotMatch(hookSource, /\.\.\.write/)
    assert.doesNotMatch(hookSource, /const writeContract:/)
    assert.match(policySource, /await attestWalletChain\(\)[\s\S]*await preflight\(\)[\s\S]*await attestWalletChain\(\)[\s\S]*return prompt\(\)/)
    assert.match(guardSource, /account\.connector\.getChainId\(\)/)
    assert.match(guardSource, /account\.connector\.getAccounts\(\)/)
  })

  it('keeps the active wallet UI on one source-declared injected connector', () => {
    const sourceImports = []
    for (const path of sourceFiles(sourceRoot)) {
      const source = readFileSync(path, 'utf8')
      if (source.includes('@rainbow-me/rainbowkit')) {
        sourceImports.push(relative(sourceRoot, path))
      }
    }

    assert.deepEqual(sourceImports, [])

    const wagmiSource = readFileSync(new URL('../config/wagmi.ts', import.meta.url), 'utf8')
    assert.match(wagmiSource, /multiInjectedProviderDiscovery: false/)
    assert.match(wagmiSource, /connectors:\s*\[\s*injected\(\),?\s*\]/)
    assert.doesNotMatch(wagmiSource, /process\.env/)

    const walletButton = readFileSync(new URL('../components/shared/InjectedWalletButton.tsx', import.meta.url), 'utf8')
    assert.match(walletButton, /connector\.id === 'injected'/)
    assert.doesNotMatch(walletButton, /window\.ethereum/)
  })

  it('requires a separate reviewed governance activation before governance writes', () => {
    const governanceHook = readFileSync(new URL('../hooks/useGovernance.ts', import.meta.url), 'utf8')
    const policySource = readFileSync(new URL('./frontendWritePolicy.ts', import.meta.url), 'utf8')
    assert.match(governanceHook, /hasApprovedGovernanceWritePath/)
    assert.match(governanceHook, /ensureGovernanceWrite/)
    assert.match(governanceHook, /legacy token\/Governor\/timelock role graph is compromised and non-executable/)
    assert.match(policySource, /LITVM_COMPROMISED_LEGACY_GOVERNANCE/)
    assert.match(policySource, /if \(configuration\.governanceActive\)/)
    assert.match(policySource, /functionName === 'castVote'/)
    assert.match(policySource, /governorRuntimeCodeHash/)
  })

  it('keeps vesting recovery to a receipt-attested value-free release(token) call', () => {
    const componentSource = readFileSync(new URL('../components/vesting/MySchedules.tsx', import.meta.url), 'utf8')
    assert.match(componentSource, /getTransactionReceipt\(wagmiConfig/)
    assert.match(componentSource, /eventName: 'VestingCreated'/)
    assert.match(componentSource, /owner\.toLowerCase\(\) === lookup\.expectedBeneficiary\.toLowerCase\(\)/)
    assert.match(componentSource, /writeRecoveryContractAsync\(\{[\s\S]*?functionName: 'release',[\s\S]*?args: \[lookup\.token\]/)
    assert.doesNotMatch(componentSource, /functionName: 'release',[\s\S]{0,120}?value:/)
  })
})

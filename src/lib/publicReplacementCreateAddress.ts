import { getContractAddress } from 'viem'

export interface PublicReplacementCreateDeployment {
  name: string
  nonce: number
  address: `0x${string}`
}

/**
 * Bind every reviewed deployment record to the declared single-use deployer.
 * Runtime hashes alone are insufficient because authority-free bytecode can be
 * identical in a disposable and a production stack.
 */
export function assertDeterministicCreateDeploymentSequence(
  gasOnlyDeployer: `0x${string}`,
  startingNonce: number,
  deployments: readonly PublicReplacementCreateDeployment[],
): void {
  if (!Number.isSafeInteger(startingNonce) || startingNonce < 0) {
    throw new Error('The replacement CREATE sequence has an invalid starting nonce.')
  }
  for (let index = 0; index < deployments.length; index += 1) {
    const deployment = deployments[index]
    const expectedNonce = startingNonce + index
    if (!Number.isSafeInteger(deployment.nonce) || deployment.nonce !== expectedNonce) {
      throw new Error(`${deployment.name} is not in the declared replacement CREATE nonce sequence.`)
    }
    const expectedAddress = getContractAddress({
      from: gasOnlyDeployer,
      nonce: BigInt(expectedNonce),
    })
    if (deployment.address.toLowerCase() !== expectedAddress.toLowerCase()) {
      throw new Error(
        `${deployment.name} address was not created by the declared gas-only deployer at nonce ${expectedNonce}.`,
      )
    }
  }
}

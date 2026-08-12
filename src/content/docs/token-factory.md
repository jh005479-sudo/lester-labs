# Token Factory

The Token Factory creates configurable ERC-20 tokens on LitVM testnet.

## Contract

| Parameter | Value |
|---|---|
| Address | `0x1A098a86d4C73b44d38e40711e0dd869591B4F60` |
| Creation fee | `0.05 zkLTC` |

## Create a token

1. Enter the token name, symbol, initial supply, and decimals.
2. Select whether minting, burning, and pausing should be available.
3. Review the fee and parameters.
4. Submit the creation transaction.

The initial supply is minted to the creator. The selected decimals value is
stored by the new token and the initial supply is passed to the factory in base
units.

## Factory functions

| Function | Description |
|---|---|
| `createToken(name, symbol, totalSupply, decimals, mintable, burnable, pausable)` | Creates a token and returns its address |
| `creationFee()` | Returns the current creation fee |

`createToken` is payable and requires the exact value returned by
`creationFee()`.

## Created-token functions

Every created token includes the standard ERC-20 functions such as
`totalSupply()`, `balanceOf()`, `transfer()`, `approve()`, and
`transferFrom()`.

| Optional function | Availability |
|---|---|
| `mint(to, amount)` | Token owner, when minting was enabled |
| `burn(amount)` | Token holder, when burning was enabled |
| `burnFrom(account, amount)` | Approved spender, when burning was enabled |
| `pause()` | Token owner, when pausing was enabled |
| `unpause()` | Token owner, when pausing was enabled |

The factory emits `TokenCreated(tokenAddress, creator, name, symbol)` after a
successful deployment.

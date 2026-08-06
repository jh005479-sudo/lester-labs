// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.5.16;

import "./interfaces/IUniswapV2Factory.sol";
import "./UniswapV2Pair.sol";

contract UniswapV2Factory is IUniswapV2Factory {
    address public feeTo;
    address public feeToSetter;
    address public deploymentSigner;
    bool public deploymentSignerMayReceiveFees;

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint256);

    constructor(address _feeToSetter, address _initialFeeTo, bool _allowDeploymentSignerAsFeeRecipient) public {
        require(_feeToSetter != address(0), "UniswapV2: ZERO_SETTER");
        require(_initialFeeTo != address(0), "UniswapV2: ZERO_FEE_TO");
        // The transaction signer may be the economic fee recipient in the
        // explicitly attested disposable-testnet profile, but can never be
        // the mutable fee controller.
        require(_feeToSetter != msg.sender, "UniswapV2: DEPLOYER_CONTROL");
        require(
            _allowDeploymentSignerAsFeeRecipient || _initialFeeTo != msg.sender,
            "UniswapV2: DEPLOYER_FEE_RECIPIENT_DISABLED"
        );
        require(_feeToSetter != _initialFeeTo, "UniswapV2: ROLES_MUST_DIFFER");
        deploymentSigner = msg.sender;
        deploymentSignerMayReceiveFees = _allowDeploymentSignerAsFeeRecipient;
        feeToSetter = _feeToSetter;
        feeTo = _initialFeeTo;
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "UniswapV2: IDENTICAL_ADDRESSES");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "UniswapV2: ZERO_ADDRESS");
        require(getPair[token0][token1] == address(0), "UniswapV2: PAIR_EXISTS"); // single check is sufficient
        bytes memory bytecode = type(UniswapV2Pair).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        IUniswapV2Pair(pair).initialize(token0, token1);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function setFeeTo(address _feeTo) external {
        require(msg.sender == feeToSetter, "UniswapV2: FORBIDDEN");
        require(_feeTo != address(0), "UniswapV2: ZERO_FEE_TO");
        require(_feeTo != deploymentSigner, "UniswapV2: DEPLOYER_CONTROL");
        require(_feeTo != feeToSetter, "UniswapV2: ROLES_MUST_DIFFER");
        feeTo = _feeTo;
    }

    function setFeeToSetter(address _feeToSetter) external {
        require(msg.sender == feeToSetter, "UniswapV2: FORBIDDEN");
        require(_feeToSetter != address(0), "UniswapV2: ZERO_SETTER");
        require(_feeToSetter != deploymentSigner, "UniswapV2: DEPLOYER_CONTROL");
        require(_feeToSetter != feeTo, "UniswapV2: ROLES_MUST_DIFFER");
        feeToSetter = _feeToSetter;
    }
}

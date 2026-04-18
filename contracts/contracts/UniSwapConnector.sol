// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IUniswapV2Router.sol";

contract UniSwapConnector is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable router;
    address public immutable factory;
    address public immutable treasury;
    address public immutable wrappedNative;

    event LiquiditySeeded(
        address indexed caller,
        address indexed token,
        address indexed pair,
        uint256 amountToken,
        uint256 amountNative,
        uint256 liquidity
    );

    constructor(address _router, address _factory, address _treasury) {
        require(_router != address(0), "Invalid router");
        require(_factory != address(0), "Invalid factory");
        require(_treasury != address(0), "Invalid treasury");
        require(IUniswapV2Router02(_router).factory() == _factory, "Router factory mismatch");

        address _wrappedNative = IUniswapV2Router02(_router).WETH();
        require(_wrappedNative != address(0), "Invalid wrapped native");

        router = _router;
        factory = _factory;
        treasury = _treasury;
        wrappedNative = _wrappedNative;
    }

    function assertTreasuryRouting() external view returns (bool) {
        _assertTreasuryRouting();
        return true;
    }

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable nonReentrant returns (address pair, uint256 amountToken, uint256 amountETH, uint256 liquidity) {
        require(token != address(0), "Invalid token");
        require(amountTokenDesired > 0, "Zero token amount");
        require(msg.value > 0, "Zero native amount");
        require(to != address(0), "Invalid recipient");

        _assertTreasuryRouting();

        IERC20 tokenContract = IERC20(token);
        tokenContract.safeTransferFrom(msg.sender, address(this), amountTokenDesired);
        tokenContract.forceApprove(router, amountTokenDesired);

        (amountToken, amountETH, liquidity) = IUniswapV2Router02(router).addLiquidityETH{value: msg.value}(
            token,
            amountTokenDesired,
            amountTokenMin,
            amountETHMin,
            to,
            deadline
        );

        pair = IUniswapV2Factory(factory).getPair(token, wrappedNative);
        require(pair != address(0), "Pair missing");

        uint256 remainingToken = amountTokenDesired - amountToken;
        if (remainingToken > 0) {
            tokenContract.safeTransfer(msg.sender, remainingToken);
        }

        uint256 remainingNative = address(this).balance;
        if (remainingNative > 0) {
            (bool refunded, ) = payable(msg.sender).call{value: remainingNative}("");
            require(refunded, "Native refund failed");
        }

        emit LiquiditySeeded(msg.sender, token, pair, amountToken, amountETH, liquidity);
    }

    function _assertTreasuryRouting() internal view {
        require(IUniswapV2Factory(factory).feeTo() == treasury, "Invalid feeTo");
        require(IUniswapV2Factory(factory).feeToSetter() == treasury, "Invalid feeToSetter");
        require(IUniswapV2Router02(router).factory() == factory, "Router factory mismatch");
    }

    receive() external payable {
        require(msg.sender == router || msg.sender == wrappedNative, "Unsupported sender");
    }
}

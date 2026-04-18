// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IUniswapV2Router.sol";

contract ILO is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── State ──────────────────────────────────────────────────────────
    address public owner;
    address public factory;
    IERC20  public token;
    address public router;
    address public connector;
    address public treasury;

    uint256 public softCap;          // minimum raise in wei (ETH/LTC)
    uint256 public hardCap;          // maximum raise in wei
    uint256 public tokensPerEth;     // how many tokens per 1 ETH (in token decimals)
    uint256 public startTime;
    uint256 public endTime;
    uint256 public liquidityBps;     // % of raised ETH to LP, in basis points (e.g. 5100 = 51%)
    uint256 public lpLockDuration;   // seconds LP is locked post-finalize
    uint256 public lpUnlockTime;     // set at finalize
    uint256 public platformFeeBps;   // e.g. 200 = 2%

    bool public whitelistEnabled;
    bool public finalized;
    bool public cancelled;

    uint256 public totalRaised;
    uint256 public lpTokensLocked;
    address public lpToken;

    mapping(address => uint256) public contributions;
    mapping(address => bool)    public whitelist;
    address[] private _contributors;

    // ── Events ─────────────────────────────────────────────────────────
    event Contributed(address indexed user, uint256 amount);
    event Finalized(address lpToken, uint256 lpAmount);
    event Cancelled();
    event Claimed(address indexed user, uint256 tokens);
    event Refunded(address indexed user, uint256 amount);
    event LPClaimed(address indexed owner, uint256 amount);
    event Whitelisted(address indexed user, bool status);

    // ── Modifiers ──────────────────────────────────────────────────────
    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }
    modifier notFinalized() { require(!finalized && !cancelled, "Already closed"); _; }

    // ── Constructor ────────────────────────────────────────────────────
    constructor(
        address _owner,
        address _token,
        address _router,
        address _connector,
        address _treasury,
        uint256 _softCap,
        uint256 _hardCap,
        uint256 _tokensPerEth,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _liquidityBps,
        uint256 _lpLockDuration,
        uint256 _platformFeeBps,
        bool    _whitelistEnabled
    ) {
        require(_softCap > 0 && _hardCap >= _softCap, "Invalid caps");
        require(_tokensPerEth > 0, "Invalid price");
        require(_startTime < _endTime, "Invalid times");
        require(_liquidityBps >= 5000 && _liquidityBps <= 10000, "Liquidity 50-100%");
        require(_lpLockDuration >= 30 days, "Lock min 30 days");
        require(_router != address(0), "Invalid router");
        require(_connector != address(0), "Invalid connector");
        require(_treasury != address(0), "Invalid treasury");

        owner          = _owner;
        factory        = msg.sender;
        token          = IERC20(_token);
        router         = _router;
        connector      = _connector;
        treasury       = _treasury;
        softCap        = _softCap;
        hardCap        = _hardCap;
        tokensPerEth   = _tokensPerEth;
        startTime      = _startTime;
        endTime        = _endTime;
        liquidityBps   = _liquidityBps;
        lpLockDuration = _lpLockDuration;
        platformFeeBps = _platformFeeBps;
        whitelistEnabled = _whitelistEnabled;
    }

    // ── Contribute ─────────────────────────────────────────────────────
    function contribute() external payable nonReentrant notFinalized {
        require(block.timestamp >= startTime, "Not started");
        require(block.timestamp <= endTime,   "Ended");
        require(msg.value > 0,                "Zero contribution");
        require(totalRaised + msg.value <= hardCap, "Hard cap reached");
        if (whitelistEnabled) require(whitelist[msg.sender], "Not whitelisted");

        if (contributions[msg.sender] == 0) {
            _contributors.push(msg.sender);
        }
        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;

        emit Contributed(msg.sender, msg.value);
    }

    // ── Finalize ────────────────────────────────────────────────────────
    // Owner can finalize after endTime or hardCap reached.
    // Permissionless: anyone can finalize after endTime if softCap met (prevents deadlock).
    function finalize() external nonReentrant notFinalized {
        require(block.timestamp > endTime || totalRaised >= hardCap, "Raise not complete");
        require(totalRaised >= softCap, "Soft cap not met");
        // Owner can always finalize; others can only finalize after endTime
        require(msg.sender == owner || block.timestamp > endTime, "Only owner before endTime");

        finalized = true;

        // Platform fee (% of ETH raised)
        uint256 platformFee = (totalRaised * platformFeeBps) / 10000;
        uint256 ethForLiquidity = ((totalRaised - platformFee) * liquidityBps) / 10000;
        uint256 ethForOwner = totalRaised - platformFee - ethForLiquidity;

        // Tokens for liquidity
        uint256 tokensForLiquidity = (ethForLiquidity * tokensPerEth) / 1e18;
        uint256 tokensForSale = (totalRaised * tokensPerEth) / 1e18;

        // Ensure contract has enough tokens (sale tokens + liquidity tokens)
        require(token.balanceOf(address(this)) >= tokensForSale + tokensForLiquidity, "Insufficient tokens");

        // The connector verifies fee routing before touching the Lester Labs DEX.
        token.forceApprove(connector, tokensForLiquidity);

        // Add liquidity on the Lester Labs router, atomically creating the pair if needed.
        (address pair, , , uint256 liquidity) = IUniSwapConnector(connector).addLiquidityETH{value: ethForLiquidity}(
            address(token),
            tokensForLiquidity,
            0,
            0,
            address(this),
            block.timestamp + 600
        );

        // Lock LP
        lpToken = pair;
        lpTokensLocked = liquidity;
        lpUnlockTime = block.timestamp + lpLockDuration;

        // Send platform fee
        if (platformFee > 0) {
            (bool ok,) = treasury.call{value: platformFee}("");
            require(ok, "Fee transfer failed");
        }

        // Send remaining ETH to owner
        if (ethForOwner > 0) {
            (bool ok2,) = owner.call{value: ethForOwner}("");
            require(ok2, "Owner transfer failed");
        }

        emit Finalized(lpToken, liquidity);
    }

    // ── Cancel (owner only, or auto if endTime passed and softCap not met) ─
    function cancel() external notFinalized {
        require(
            msg.sender == owner ||
            (block.timestamp > endTime && totalRaised < softCap),
            "Cannot cancel"
        );
        cancelled = true;
        emit Cancelled();
    }

    // ── Claim tokens (contributors, after finalize) ────────────────────
    function claim() external nonReentrant {
        require(finalized, "Not finalized");
        uint256 contribution = contributions[msg.sender];
        require(contribution > 0, "Nothing to claim");

        contributions[msg.sender] = 0;
        uint256 tokens = (contribution * tokensPerEth) / 1e18;
        token.safeTransfer(msg.sender, tokens);

        emit Claimed(msg.sender, tokens);
    }

    // ── Refund (contributors, after cancel or emergency) ────────────────
    // Refundable if: cancelled, soft cap not met, OR emergency (7 days past endTime and not finalized)
    function refund() external nonReentrant {
        bool softCapFailed = block.timestamp > endTime && totalRaised < softCap;
        bool emergencyRefund = block.timestamp > endTime + 7 days && !finalized;
        require(cancelled || softCapFailed || emergencyRefund, "Not refundable");
        uint256 amount = contributions[msg.sender];
        require(amount > 0, "Nothing to refund");

        contributions[msg.sender] = 0;
        totalRaised -= amount;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "Refund failed");

        emit Refunded(msg.sender, amount);
    }

    // ── Claim LP (owner, after lock expires) ───────────────────────────
    function claimLP() external onlyOwner nonReentrant {
        require(finalized, "Not finalized");
        require(block.timestamp >= lpUnlockTime, "LP still locked");
        require(lpTokensLocked > 0, "Already claimed");

        uint256 amount = lpTokensLocked;
        lpTokensLocked = 0;
        IERC20(lpToken).safeTransfer(owner, amount);

        emit LPClaimed(owner, amount);
    }

    // ── Sweep excess ETH (owner only, post-finalize) ───────────────────
    // addLiquidityETH may not use all allocated ETH if router adjusts amounts.
    // This function recovers any residual ETH after finalization.
    function sweepExcessETH() external onlyOwner nonReentrant {
        require(finalized, "Not finalized");
        uint256 balance = address(this).balance;
        require(balance > 0, "No excess ETH");
        (bool ok,) = owner.call{value: balance}("");
        require(ok, "Transfer failed");
    }

    // ── Whitelist management (owner only) ──────────────────────────────
    function setWhitelist(address[] calldata users, bool status) external onlyOwner {
        for (uint256 i = 0; i < users.length; i++) {
            whitelist[users[i]] = status;
            emit Whitelisted(users[i], status);
        }
    }

    // ── View helpers ───────────────────────────────────────────────────
    function getContributorCount() external view returns (uint256) {
        return _contributors.length;
    }

    function tokensRequired() external view returns (uint256) {
        // Tokens for sale (based on gross raised amount)
        uint256 forSale = (hardCap * tokensPerEth) / 1e18;
        // Tokens for liquidity: calculated on NET amount after platform fee (matches finalize() logic)
        uint256 netHardCap = hardCap - (hardCap * platformFeeBps) / 10000;
        uint256 ethForLiquidity = (netHardCap * liquidityBps) / 10000;
        uint256 forLiquidity = (ethForLiquidity * tokensPerEth) / 1e18;
        return forSale + forLiquidity;
    }

    receive() external payable {}
}

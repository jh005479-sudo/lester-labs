// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ILO.sol";

contract ILOFactory is Ownable {
    address public router;
    address public connector;
    address public treasury;
    uint256 public platformFeeBps;  // default 200 = 2%
    uint256 public creationFee;     // flat fee in native token to create an ILO

    address[] public allILOs;
    mapping(address => address[]) public ownerILOs;  // owner => ILOs they created

    event ILOCreated(
        address indexed ilo,
        address indexed token,
        address indexed owner,
        uint256 softCap,
        uint256 hardCap
    );

    constructor(
        address _router,
        address _treasury,
        uint256 _platformFeeBps,
        uint256 _creationFee
    ) Ownable(msg.sender) {
        router         = _router;
        treasury       = _treasury;
        platformFeeBps = _platformFeeBps;
        creationFee    = _creationFee;
    }

    function createILO(
        address token,
        uint256 softCap,
        uint256 hardCap,
        uint256 tokensPerEth,
        uint256 startTime,
        uint256 endTime,
        uint256 liquidityBps,
        uint256 lpLockDuration,
        bool    whitelistEnabled
    ) external payable returns (address) {
        require(msg.value >= creationFee, "Insufficient creation fee");
        require(router != address(0), "Router not configured");
        require(connector != address(0), "Connector not configured");
        require(treasury != address(0), "Treasury not configured");

        ILO ilo = new ILO(
            msg.sender,
            token,
            router,
            connector,
            treasury,
            softCap,
            hardCap,
            tokensPerEth,
            startTime,
            endTime,
            liquidityBps,
            lpLockDuration,
            platformFeeBps,
            whitelistEnabled
        );

        allILOs.push(address(ilo));
        ownerILOs[msg.sender].push(address(ilo));

        // Forward creation fee to treasury
        if (creationFee > 0) {
            (bool ok,) = treasury.call{value: creationFee}("");
            require(ok, "Fee transfer failed");
        }

        // Refund any excess payment to prevent trapped funds
        if (msg.value > creationFee) {
            (bool refunded,) = msg.sender.call{value: msg.value - creationFee}("");
            require(refunded, "Refund failed");
        }

        emit ILOCreated(address(ilo), token, msg.sender, softCap, hardCap);
        return address(ilo);
    }

    function getILOCount() external view returns (uint256) {
        return allILOs.length;
    }

    function getOwnerILOs(address _owner) external view returns (address[] memory) {
        return ownerILOs[_owner];
    }

    // Admin
    function setRouter(address _router)         external onlyOwner { router = _router; }
    function setConnector(address _connector)   external onlyOwner { connector = _connector; }
    function setTreasury(address _treasury)     external onlyOwner { treasury = _treasury; }
    function setPlatformFee(uint256 _bps)       external onlyOwner { require(_bps <= 500, "Max 5%"); platformFeeBps = _bps; }
    function setCreationFee(uint256 _fee)       external onlyOwner { creationFee = _fee; }
}

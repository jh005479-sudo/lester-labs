// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ILO.sol";

interface IConnectorConfiguration {
    function router() external view returns (address);
    function factory() external view returns (address);
    function treasury() external view returns (address);
    function controller() external view returns (address);
    function assertTreasuryRouting() external view returns (bool);
}

interface IRouterConfiguration {
    function factory() external view returns (address);
}

contract ILOFactory is Ownable, ReentrancyGuard {
    uint256 public constant MAX_CREATION_FEE = 0.1 ether;
    address public router;
    address public connector;
    address public immutable dexFactory;
    address public immutable deploymentSigner;
    bool public immutable deploymentSignerMayReceiveFees;
    address public treasury;
    uint256 public platformFeeBps; // default 200 = 2%
    uint256 public creationFee; // flat fee in native token to create an ILO

    address[] public allILOs;
    mapping(address => address[]) public ownerILOs; // owner => ILOs they created

    event ILOCreated(
        address indexed ilo, address indexed token, address indexed owner, uint256 softCap, uint256 hardCap
    );
    event RoutingUpdated(
        address indexed previousRouter,
        address indexed newRouter,
        address previousConnector,
        address newConnector,
        address previousTreasury,
        address newTreasury
    );
    event ControllerRotated(
        address indexed previousController,
        address indexed newController,
        address indexed newConnector
    );

    constructor(
        address _router,
        address _connector,
        address _treasury,
        uint256 _platformFeeBps,
        uint256 _creationFee,
        address _initialOwner,
        bool _allowDeploymentSignerAsFeeRecipient
    ) Ownable(_initialOwner) {
        require(_router != address(0) && _router.code.length > 0, "Invalid router");
        require(_connector != address(0) && _connector.code.length > 0, "Invalid connector");
        require(_treasury != address(0), "Invalid treasury");
        require(_initialOwner != msg.sender, "Deployer cannot control");
        require(_allowDeploymentSignerAsFeeRecipient || _treasury != msg.sender, "Deployer fee recipient disabled");
        require(_initialOwner != _treasury, "Owner and treasury must differ");
        require(_platformFeeBps <= 500, "Max 5%");
        require(_creationFee <= MAX_CREATION_FEE, "Creation fee too high");
        address _dexFactory = IRouterConfiguration(_router).factory();
        require(_dexFactory != address(0) && _dexFactory.code.length > 0, "Invalid DEX factory");
        _requireMatchingConnector(_router, _connector, _dexFactory, _treasury, _initialOwner);

        router = _router;
        connector = _connector;
        dexFactory = _dexFactory;
        deploymentSigner = msg.sender;
        deploymentSignerMayReceiveFees = _allowDeploymentSignerAsFeeRecipient;
        treasury = _treasury;
        platformFeeBps = _platformFeeBps;
        creationFee = _creationFee;
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
        bool whitelistEnabled
    ) external payable nonReentrant returns (address) {
        require(msg.value >= creationFee, "Insufficient creation fee");
        require(router != address(0), "Router not configured");
        require(connector != address(0), "Connector not configured");
        require(treasury != address(0), "Treasury not configured");
        _requireMatchingConnector(router, connector, dexFactory, treasury, owner());

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
    function setRouter(address _router) external onlyOwner {
        require(_router != address(0) && _router.code.length > 0, "Invalid router");
        _requireMatchingConnector(_router, connector, dexFactory, treasury, owner());
        address previousRouter = router;
        router = _router;
        emit RoutingUpdated(previousRouter, _router, connector, connector, treasury, treasury);
    }

    function setConnector(address _connector) external onlyOwner {
        require(_connector != address(0) && _connector.code.length > 0, "Invalid connector");
        _requireMatchingConnector(router, _connector, dexFactory, treasury, owner());
        address previousConnector = connector;
        connector = _connector;
        emit RoutingUpdated(router, router, previousConnector, _connector, treasury, treasury);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        require(_treasury != deploymentSigner, "Deployer cannot control");
        require(_treasury != owner(), "Owner and treasury must differ");
        _requireMatchingConnector(router, connector, dexFactory, _treasury, owner());
        address previousTreasury = treasury;
        treasury = _treasury;
        emit RoutingUpdated(router, router, connector, connector, previousTreasury, _treasury);
    }

    function setRouting(address _router, address _connector, address _treasury) external onlyOwner {
        require(_router != address(0) && _router.code.length > 0, "Invalid router");
        require(_connector != address(0) && _connector.code.length > 0, "Invalid connector");
        require(_treasury != address(0), "Invalid treasury");
        require(_treasury != deploymentSigner, "Deployer cannot control");
        require(_treasury != owner(), "Owner and treasury must differ");
        _requireMatchingConnector(_router, _connector, dexFactory, _treasury, owner());
        address previousRouter = router;
        address previousConnector = connector;
        address previousTreasury = treasury;
        router = _router;
        connector = _connector;
        treasury = _treasury;
        emit RoutingUpdated(
            previousRouter,
            _router,
            previousConnector,
            _connector,
            previousTreasury,
            _treasury
        );
    }

    /**
     * @notice Atomically binds a replacement controller to its reviewed DEX
     *         and connector tuple before transferring factory ownership.
     * @dev The current controller must first update the DEX feeTo/feeToSetter
     *      to the proposed treasury/controller in the same multisig batch.
     *      A plain Ownable transfer would leave connector.controller() pinned
     *      to the former owner and permanently disable createILO().
     */
    function rotateControlAndRouting(
        address _newController,
        address _router,
        address _connector,
        address _treasury
    ) external onlyOwner {
        require(_newController != address(0), "Invalid controller");
        require(_router != address(0) && _router.code.length > 0, "Invalid router");
        require(_connector != address(0) && _connector.code.length > 0, "Invalid connector");
        require(_treasury != address(0), "Invalid treasury");
        require(_newController != deploymentSigner && _treasury != deploymentSigner, "Deployer cannot control");
        require(_newController != _treasury, "Owner and treasury must differ");
        _requireMatchingConnector(_router, _connector, dexFactory, _treasury, _newController);

        address previousController = owner();
        address previousRouter = router;
        address previousConnector = connector;
        address previousTreasury = treasury;
        router = _router;
        connector = _connector;
        treasury = _treasury;
        _transferOwnership(_newController);

        emit RoutingUpdated(
            previousRouter,
            _router,
            previousConnector,
            _connector,
            previousTreasury,
            _treasury
        );
        emit ControllerRotated(previousController, _newController, _connector);
    }

    function setPlatformFee(uint256 _bps) external onlyOwner {
        require(_bps <= 500, "Max 5%");
        platformFeeBps = _bps;
    }

    function setCreationFee(uint256 _fee) external onlyOwner {
        require(_fee <= MAX_CREATION_FEE, "Creation fee too high");
        creationFee = _fee;
    }

    function transferOwnership(address newOwner) public override onlyOwner {
        require(newOwner != deploymentSigner, "Deployer cannot control");
        require(newOwner != treasury, "Owner and treasury must differ");
        revert("Use rotateControlAndRouting");
    }

    function renounceOwnership() public override onlyOwner {
        revert("ILOFactory ownership is required");
    }

    function _requireMatchingConnector(
        address _router,
        address _connector,
        address _dexFactory,
        address _treasury,
        address _controller
    ) internal view {
        require(IConnectorConfiguration(_connector).router() == _router, "Connector router mismatch");
        require(IRouterConfiguration(_router).factory() == _dexFactory, "Router factory mismatch");
        require(IConnectorConfiguration(_connector).factory() == _dexFactory, "Connector factory mismatch");
        require(IConnectorConfiguration(_connector).treasury() == _treasury, "Connector treasury mismatch");
        require(IConnectorConfiguration(_connector).controller() == _controller, "Connector controller mismatch");
        require(IConnectorConfiguration(_connector).assertTreasuryRouting(), "Invalid connector routing");
    }
}

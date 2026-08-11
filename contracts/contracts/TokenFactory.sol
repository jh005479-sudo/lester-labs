// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract LesterToken is ERC20, ERC20Burnable, ERC20Pausable, Ownable {
    bool public mintable;
    bool public burnable;
    bool public pausable;
    uint8 private immutable _customDecimals;

    /**
     * @dev Creates a new token.
     * @param totalSupply_ The initial supply in BASE UNITS (already scaled by 10^decimals).
     *        Convention: UI passes base units via parseUnits(), contract mints exactly that amount.
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 totalSupply_,
        uint8 decimals_,
        bool _mintable,
        bool _burnable,
        bool _pausable,
        address owner
    ) ERC20(name, symbol) Ownable(owner) {
        mintable = _mintable;
        burnable = _burnable;
        pausable = _pausable;
        _customDecimals = decimals_;
        // totalSupply_ is already in base units - mint exactly what's passed
        _mint(owner, totalSupply_);
    }

    function decimals() public view virtual override returns (uint8) {
        return _customDecimals;
    }

    function mint(address to, uint256 amount) public onlyOwner {
        require(mintable, "Not mintable");
        _mint(to, amount);
    }

    function burn(uint256 amount) public virtual override {
        require(burnable, "Token is not burnable");
        super.burn(amount);
    }

    function burnFrom(address account, uint256 amount) public virtual override {
        require(burnable, "Token is not burnable");
        super.burnFrom(account, amount);
    }

    function pause() public onlyOwner {
        require(pausable, "Not pausable");
        _pause();
    }

    function unpause() public onlyOwner {
        require(pausable, "Not pausable");
        _unpause();
    }

    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, value);
    }
}

contract TokenFactory is Ownable, ReentrancyGuard {
    uint256 public constant MAX_CREATION_FEE = 0.1 ether;
    address public immutable deploymentSigner;
    bool public immutable deploymentSignerMayReceiveFees;
    uint256 public creationFee;
    address public treasury;

    event TokenCreated(address indexed tokenAddress, address indexed creator, string name, string symbol);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event ProtocolFeeForwarded(address indexed treasury, uint256 amount);

    constructor(
        uint256 _creationFee,
        address _initialOwner,
        address _treasury,
        bool _allowDeploymentSignerAsFeeRecipient
    ) Ownable(_initialOwner) {
        require(_treasury != address(0), "Invalid treasury");
        // Treasury is an economic recipient, not an administrative role. The
        // deployment signer may receive valueless testnet fees, but can never
        // own or reconfigure the factory.
        require(_initialOwner != msg.sender, "Deployer cannot control");
        require(_allowDeploymentSignerAsFeeRecipient || _treasury != msg.sender, "Deployer fee recipient disabled");
        require(_initialOwner != _treasury, "Owner and treasury must differ");
        require(_creationFee <= MAX_CREATION_FEE, "Fee too high");
        deploymentSigner = msg.sender;
        deploymentSignerMayReceiveFees = _allowDeploymentSignerAsFeeRecipient;
        creationFee = _creationFee;
        treasury = _treasury;
    }

    function createToken(
        string memory name,
        string memory symbol,
        uint256 totalSupply,
        uint8 decimals,
        bool mintable,
        bool burnable,
        bool pausable
    ) external payable nonReentrant returns (address tokenAddress) {
        require(msg.value == creationFee, "Incorrect fee amount"); // RP-004: exact fee policy

        LesterToken token =
            new LesterToken(name, symbol, totalSupply, decimals, mintable, burnable, pausable, msg.sender);

        tokenAddress = address(token);
        _forwardProtocolFee(msg.value);
        emit TokenCreated(tokenAddress, msg.sender, name, symbol);
    }

    function setFee(uint256 _fee) external onlyOwner {
        require(_fee <= MAX_CREATION_FEE, "Fee too high");
        creationFee = _fee;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        require(_treasury != deploymentSigner, "Deployer cannot control");
        require(_treasury != owner(), "Owner and treasury must differ");
        address previousTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(previousTreasury, _treasury);
    }

    function transferOwnership(address newOwner) public override onlyOwner {
        require(newOwner != deploymentSigner, "Deployer cannot control");
        require(newOwner != treasury, "Owner and treasury must differ");
        super.transferOwnership(newOwner);
    }

    function _forwardProtocolFee(uint256 amount) internal {
        if (amount == 0) return;
        (bool success,) = payable(treasury).call{value: amount}("");
        require(success, "Fee forwarding failed");
        emit ProtocolFeeForwarded(treasury, amount);
    }
}

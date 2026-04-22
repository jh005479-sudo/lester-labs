// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/TimelockController.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/governance/IGovernor.sol";

/**
 * @title LitGovernor — minimal on-chain governor for LitVM
 *
 * Features:
 *   • Voting weight from any ERC20Votes-compatible token (LitGovToken)
 *   • On-chain proposal lifecycle: Pending → Active → Defeated / Succeeded → Queued → Executed
 *   • Configurable voting delay, period, quorum, proposal threshold
 *   • TimelockController integration (2-day delay between succeed and execute)
 *   • EIP-712 vote delegation support via token
 *   • ERC-6372 clock (blocknumber)
 *   • Proposal details stored on-chain for reliable queue/execute
 */
contract LitGovernor {
    using SafeCast for uint256;

    // ── Types ───────────────────────────────────────────────────────────

    enum ProposalState { Pending, Active, Defeated, Succeeded, Queued, Executed, Canceled }

    struct ProposalCore {
        uint64 snapshotBlock;
        uint64 startBlock;
        uint64 endBlock;
        address proposer;
        bool canceled;
    }

    struct ProposalDetails {
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        string description;
    }

    // ── immutables ──────────────────────────────────────────────────────
    // Trailing underscore on ALL immutables to avoid constructor-param shadowing

    ERC20Votes public immutable token;
    TimelockController public immutable timelock;
    uint256 public immutable votingDelay_;        // blocks before voting starts
    uint256 public immutable votingPeriod_;       // blocks voting window
    uint256 public immutable proposalThreshold_;  // min delegated power to propose
    uint256 public immutable quorumBps_;          // basis points (100 = 1%)

    // ── storage ────────────────────────────────────────────────────────

    uint256 private _proposalCount;

    mapping(uint256 => ProposalCore) private _proposals;
    mapping(uint256 => ProposalDetails) private _proposalDetails;
    mapping(uint256 => mapping(uint8 => uint256)) private _voteTally;
    mapping(uint256 => mapping(address => bool)) private _hasVoted;
    mapping(uint256 => bytes32) private _timelockIds;

    // ── events ─────────────────────────────────────────────────────────

    event ProposalCreated(
        uint256 indexed proposalId,
        address proposer,
        uint64 startBlock,
        uint64 endBlock,
        string description
    );
    event VoteCast(uint256 indexed proposalId, address voter, uint8 support, uint256 weight);
    event ProposalCanceled(uint256 indexed proposalId);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalQueued(uint256 indexed proposalId);

    // ── constants ──────────────────────────────────────────────────────

    uint8 public constant AGAINST = 0;
    uint8 public constant FOR     = 1;
    uint8 public constant ABSTAIN = 2;

    // ── constructor ────────────────────────────────────────────────────
    // Params WITHOUT trailing underscore; immutables WITH underscore.
    // This avoids the Solidity shadowing bug where same-named constructor
    // params produce self-assignment (immutable stays at default/0).

    constructor(
        ERC20Votes token_,
        TimelockController timelock_,
        uint256 votingDelay,
        uint256 votingPeriod,
        uint256 proposalThreshold,
        uint256 quorumBps
    ) {
        token = token_;
        timelock = timelock_;
        votingDelay_ = votingDelay;
        votingPeriod_ = votingPeriod;
        proposalThreshold_ = proposalThreshold;
        quorumBps_ = quorumBps;
    }

    // ── ERC-6372 clock ─────────────────────────────────────────────────

    function clock() public view returns (uint48) {
        return uint48(block.number);
    }

    function CLOCK_MODE() public pure returns (string memory) {
        return "mode=blocknumber&from=default";
    }

    // ── proposal creation ─────────────────────────────────────────────

    /**
     * @notice Create a new proposal. Caller must have > proposalThreshold delegated voting power.
     */
    function propose(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas,
        string calldata description
    ) external returns (uint256 proposalId) {
        uint256 weight = token.getVotes(msg.sender);
        require(weight >= proposalThreshold_, "Governor: proposer below threshold");
        require(
            targets.length == values.length && targets.length == calldatas.length,
            "Governor: mismatched arrays"
        );
        require(targets.length > 0, "Governor: empty proposal");

        uint64 snapshot = uint64(block.number) + uint64(votingDelay_);
        uint64 startBlock = snapshot;
        uint64 endBlock   = startBlock + uint64(votingPeriod_);

        proposalId = ++_proposalCount;

        _proposals[proposalId] = ProposalCore({
            snapshotBlock: snapshot,
            startBlock: startBlock,
            endBlock: endBlock,
            proposer: msg.sender,
            canceled: false
        });

        // Store details for queue/execute paths
        _proposalDetails[proposalId] = ProposalDetails({
            targets: targets,
            values: values,
            calldatas: calldatas,
            description: description
        });

        emit ProposalCreated(proposalId, msg.sender, startBlock, endBlock, description);
    }

    // ── voting ─────────────────────────────────────────────────────────

    function castVote(uint256 proposalId, uint8 support) external {
        require(support <= ABSTAIN, "Governor: invalid vote type");
        _castVote(proposalId, msg.sender, support);
    }

    function castVoteWithReason(
        uint256 proposalId,
        uint8 support,
        string calldata reason
    ) external {
        require(support <= ABSTAIN, "Governor: invalid vote type");
        _castVote(proposalId, msg.sender, support);
        // Reason not stored on-chain in this minimal version
    }

    /**
     * @notice Cast a vote via EIP-712 signature (off-chain vote + on-chain tally)
     */
    function castVoteBySig(
        uint256 proposalId,
        uint8 support,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(support <= ABSTAIN, "Governor: invalid vote type");

        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
                keccak256("LitGovernor"),
                block.chainid,
                address(this)
            )
        );
        bytes32 structHash = keccak256(abi.encode(
            keccak256("Ballot(uint256 proposalId,uint8 support)"),
            proposalId,
            support
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "Governor: invalid signature");
        _castVote(proposalId, signer, support);
    }

    function _castVote(
        uint256 proposalId,
        address voter,
        uint8 support
    ) internal returns (uint256 weight) {
        require(state(proposalId) == ProposalState.Active, "Governor: voting not active");
        require(!_hasVoted[proposalId][voter], "Governor: already voted");

        weight = token.getPastVotes(voter, _proposals[proposalId].snapshotBlock);
        require(weight > 0, "Governor: no voting power");

        _hasVoted[proposalId][voter] = true;
        _voteTally[proposalId][support] += weight;

        emit VoteCast(proposalId, voter, support, weight);
    }

    // ── queue ─────────────────────────────────────────────────────────

    /**
     * @notice Queue a succeeded proposal into the timelock. Callable by anyone.
     */
    function queue(uint256 proposalId) external {
        require(state(proposalId) == ProposalState.Succeeded, "Governor: not succeeded");

        ProposalDetails storage details = _proposalDetails[proposalId];
        bytes32 salt = _timelockSalt(proposalId);

        bytes32 opId = timelock.hashOperationBatch(
            details.targets,
            details.values,
            details.calldatas,
            0,
            salt
        );
        _timelockIds[proposalId] = opId;

        timelock.scheduleBatch(
            details.targets,
            details.values,
            details.calldatas,
            0,
            salt,
            timelock.getMinDelay()
        );

        emit ProposalQueued(proposalId);
    }

    // ── execute ───────────────────────────────────────────────────────

    /**
     * @notice Execute a queued proposal through the timelock once the delay has passed.
     */
    function execute(uint256 proposalId) external payable {
        _executeQueuedProposal(proposalId);
    }

    /**
     * @notice Execute a queued timelock operation after the delay has passed.
     */
    function executeTimelocked(uint256 proposalId) external {
        _executeQueuedProposal(proposalId);
    }

    function _executeQueuedProposal(uint256 proposalId) internal {
        require(state(proposalId) == ProposalState.Queued, "Governor: not queued");

        ProposalDetails storage details = _proposalDetails[proposalId];
        bytes32 salt = _timelockSalt(proposalId);

        timelock.executeBatch(
            details.targets,
            details.values,
            details.calldatas,
            0,
            salt
        );
        emit ProposalExecuted(proposalId);
    }

    // ── cancellation ──────────────────────────────────────────────────

    function cancel(uint256 proposalId) external {
        require(msg.sender == _proposals[proposalId].proposer, "Governor: not proposer");
        ProposalState s = state(proposalId);
        require(
            s == ProposalState.Pending ||
            s == ProposalState.Active  ||
            s == ProposalState.Succeeded,
            "Governor: cannot cancel"
        );
        _cancel(proposalId);
    }

    function _cancel(uint256 proposalId) internal {
        _proposals[proposalId].canceled = true;
        bytes32 opId = _timelockIds[proposalId];
        if (opId != bytes32(0)) {
            timelock.cancel(opId);
        }
        emit ProposalCanceled(proposalId);
    }

    // ── public query functions ─────────────────────────────────────────

    function proposalCount() external view returns (uint256) {
        return _proposalCount;
    }

    function proposals(uint256 proposalId) external view returns (ProposalCore memory) {
        require(_proposals[proposalId].snapshotBlock != 0, "Governor: unknown proposal");
        return _proposals[proposalId];
    }

    function proposalDetails(uint256 proposalId) external view returns (ProposalDetails memory) {
        require(_proposals[proposalId].snapshotBlock != 0, "Governor: unknown proposal");
        return _proposalDetails[proposalId];
    }

    function proposalVotes(uint256 proposalId)
        external
        view
        returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes)
    {
        return (
            _voteTally[proposalId][AGAINST],
            _voteTally[proposalId][FOR],
            _voteTally[proposalId][ABSTAIN]
        );
    }

    // These shadow the immutable state variables but public getters for
    // IGovernor compatibility must use these exact names (without underscore)
    function proposalThreshold() external view returns (uint256) {
        return proposalThreshold_;
    }

    function votingDelay() external view returns (uint256) {
        return votingDelay_;
    }

    function votingPeriod() external view returns (uint256) {
        return votingPeriod_;
    }

    function quorum(uint256 proposalId) external view returns (uint256) {
        uint256 snapshotSupply = token.getPastTotalSupply(_proposals[proposalId].snapshotBlock);
        return (snapshotSupply * quorumBps_) / 10_000;
    }

    function timelockId(uint256 proposalId) external view returns (bytes32) {
        return _timelockIds[proposalId];
    }

    function hasVoted(uint256 proposalId, address account) external view returns (bool) {
        return _hasVoted[proposalId][account];
    }

    // ── proposal state ─────────────────────────────────────────────────

    function state(uint256 proposalId) public view returns (ProposalState) {
        ProposalCore memory p = _proposals[proposalId];

        if (p.snapshotBlock == 0) revert("Governor: unknown proposal");
        if (p.canceled) return ProposalState.Canceled;

        uint256 currentBlock = block.number;

        if (currentBlock < p.startBlock)  return ProposalState.Pending;
        if (currentBlock <= p.endBlock)   return ProposalState.Active;

        // voting closed
        bytes32 opId = _timelockIds[proposalId];
        if (opId != bytes32(0)) {
            if (timelock.isOperationDone(opId)) return ProposalState.Executed;
            if (timelock.isOperation(opId))    return ProposalState.Queued;
        }

        if (_isDefeated(proposalId)) return ProposalState.Defeated;
        return ProposalState.Succeeded;
    }

    function _isDefeated(uint256 proposalId) internal view returns (bool) {
        uint256 forVotes     = _voteTally[proposalId][FOR];
        uint256 againstVotes = _voteTally[proposalId][AGAINST];
        uint256 abstainVotes = _voteTally[proposalId][ABSTAIN];

        uint256 snapshotSupply = token.getPastTotalSupply(_proposals[proposalId].snapshotBlock);
        uint256 quorumNeeded   = (snapshotSupply * quorumBps_) / 10_000;

        if (forVotes + againstVotes + abstainVotes < quorumNeeded) {
            return true;
        }
        return forVotes <= againstVotes;
    }

    // ── helpers ───────────────────────────────────────────────────────

    function _timelockSalt(uint256 proposalId) internal view returns (bytes32) {
        return keccak256(abi.encode(address(this), proposalId, "litgovernor.v1"));
    }

    // ── EIP-165 ───────────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IGovernor).interfaceId;
    }

    // ── receive ETH ───────────────────────────────────────────────────

    receive() external payable {}
}

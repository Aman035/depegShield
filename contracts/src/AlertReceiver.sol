// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AbstractCallback} from "reactive-lib/abstract-base/AbstractCallback.sol";
import {IAlertReceiver} from "./interfaces/IAlertReceiver.sol";

/// @title AlertReceiver
/// @notice Receives cross-chain depeg alerts from the Reactive Network and stores per-pair
///         imbalance ratios. Deployed on each destination chain. The DepegShieldHook reads
///         the cross-chain ratio and uses it as a fee floor.
///
///         Alerts are keyed by owner-assigned pairId (e.g. keccak256("USDC/USDT")), which
///         is consistent across chains. Local token addresses are mapped to pairId via
///         registerPair(), so the same pairId works regardless of per-chain token addresses.
contract AlertReceiver is AbstractCallback, IAlertReceiver {
    uint256 public constant RATIO_PRECISION = 10000;

    /// @dev Ratios at or below this threshold are treated as "balanced" and clear the alert.
    ///      50 basis points of noise margin avoids storing alerts for negligible imbalances.
    uint256 public constant CLEAR_THRESHOLD = 10050;

    struct Alert {
        uint128 sourceRatio;  // imbalance ratio (10000 = balanced); max ~100k in practice
        uint40 timestamp;
        uint40 ttl;
        uint48 sourceChainId; // chain IDs fit in 48 bits (max ~281 trillion)
    }

    address public owner;

    /// @dev pairId => Alert
    mapping(bytes32 => Alert) public alerts;

    /// @dev keccak256(abi.encodePacked(sorted(localA, localB))) => owner-assigned pairId
    mapping(bytes32 => bytes32) public tokenPairToId;

    event AlertSet(bytes32 indexed pairId, uint128 sourceRatio, uint48 sourceChainId, uint40 ttl);
    event AlertCleared(bytes32 indexed pairId, uint48 sourceChainId);
    event PairRegistered(bytes32 indexed pairId, address token0, address token1);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address _callbackSender) AbstractCallback(_callbackSender) {
        owner = msg.sender;
    }

    /// @notice Register a local token pair under an owner-assigned pairId.
    /// @param pairId Arbitrary label (e.g. keccak256("USDC/USDT")), same across all chains.
    /// @param localToken0 First token address on this chain.
    /// @param localToken1 Second token address on this chain.
    function registerPair(bytes32 pairId, address localToken0, address localToken1) external onlyOwner {
        require(localToken0 != localToken1, "Identical tokens");
        require(localToken0 != address(0) && localToken1 != address(0), "Zero address");

        bytes32 key = _pairKey(localToken0, localToken1);
        tokenPairToId[key] = pairId;

        (address sorted0, address sorted1) = localToken0 < localToken1
            ? (localToken0, localToken1)
            : (localToken1, localToken0);
        emit PairRegistered(pairId, sorted0, sorted1);
    }

    /// @notice Called by ReactVM via callback proxy to set or clear an alert.
    /// @param /* rvmId */ First 32 bytes are replaced by Reactive Network with the deployer
    ///        address (rvm_id). This parameter absorbs that injection so subsequent args are correct.
    /// @param pairId The pair identifier (owner-assigned, from ReactiveMonitor).
    /// @param sourceRatio The imbalance ratio on the source chain (10000 = balanced).
    ///        Values <= RATIO_PRECISION clear the alert.
    /// @param sourceChainId The chain where the depeg was detected.
    /// @param ttl Time-to-live in seconds. Alert expires after timestamp + ttl.
    function handleAlert(
        address /* rvmId */,
        bytes32 pairId,
        uint256 sourceRatio,
        uint256 sourceChainId,
        uint40 ttl
    ) external authorizedSenderOnly {
        require(pairId != bytes32(0), "Invalid pairId");

        if (sourceRatio <= CLEAR_THRESHOLD) {
            delete alerts[pairId];
            emit AlertCleared(pairId, uint48(sourceChainId));
        } else {
            alerts[pairId] = Alert({
                sourceRatio: uint128(sourceRatio),
                timestamp: uint40(block.timestamp),
                ttl: ttl,
                sourceChainId: uint48(sourceChainId)
            });
            emit AlertSet(pairId, uint128(sourceRatio), uint48(sourceChainId), ttl);
        }
    }

    /// @inheritdoc IAlertReceiver
    function getCrossChainRatio(address tokenA, address tokenB) external view override returns (uint256) {
        bytes32 key = _pairKey(tokenA, tokenB);
        bytes32 pairId = tokenPairToId[key];
        if (pairId == bytes32(0)) return 0;

        Alert storage a = alerts[pairId];
        if (a.sourceRatio == 0) return 0;
        if (block.timestamp > uint256(a.timestamp) + uint256(a.ttl)) return 0;
        return a.sourceRatio;
    }

    /// @notice Get full alert details for a pairId.
    function getAlert(bytes32 pairId) external view returns (Alert memory) {
        return alerts[pairId];
    }

    /// @notice Get full alert details by local token addresses.
    function getAlertForTokens(address tokenA, address tokenB) external view returns (Alert memory) {
        bytes32 key = _pairKey(tokenA, tokenB);
        bytes32 pairId = tokenPairToId[key];
        return alerts[pairId];
    }

    /// @dev Compute canonical key from two token addresses (order-independent).
    function _pairKey(address a, address b) internal pure returns (bytes32) {
        (address sorted0, address sorted1) = a < b ? (a, b) : (b, a);
        return keccak256(abi.encodePacked(sorted0, sorted1));
    }
}

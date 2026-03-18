// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AbstractReactive} from "reactive-lib/abstract-base/AbstractReactive.sol";

/// @title ReactiveMonitor
/// @notice Deployed on Reactive Lasna. Monitors pool events across chains and relays
///         the raw imbalance ratio to AlertReceiver contracts on destination chains.
///         Supports 3 pool types: Uniswap V4, Uniswap V3, and Uniswap V2.
///
///         Alerts are keyed by owner-assigned pairId (e.g. keccak256("USDC/USDT")),
///         which is the same across all chains. This avoids the problem of different
///         token addresses on different chains.
///
///         Deploy with value (e.g. --value 0.1ether) to fund subscription fees.
///         After deployment, call addMonitoredPool() for each pool and addDestination()
///         for each target chain.
contract ReactiveMonitor is AbstractReactive {
    enum PoolType { UNISWAP_V4, UNISWAP_V3, UNISWAP_V2 }

    struct MonitoredPool {
        uint256 chainId;
        address poolAddr;
        bytes32 pairId;     // owner-assigned, consistent across chains
        PoolType poolType;
        bytes32 poolId;     // V4 only: PoolId to filter Swap events from singleton PoolManager
    }

    struct Destination {
        uint256 chainId;
        address alertReceiver;
    }

    /// @dev Constructor config structs (same fields, used for calldata)
    struct PoolConfig {
        uint256 chainId;
        address poolAddr;
        bytes32 pairId;
        PoolType poolType;
        bytes32 poolId;
    }

    struct DestConfig {
        uint256 chainId;
        address alertReceiver;
    }

    // --- Constants ---
    uint160 private constant Q96 = uint160(1 << 96);
    uint256 private constant RATIO_PRECISION = 10000;
    uint64 private constant CALLBACK_GAS_LIMIT = 500_000;

    /// @dev Only relay if ratio changed by more than this threshold (50 = 0.5%).
    ///      Prevents spamming callbacks on tiny price movements.
    uint256 private constant RELAY_THRESHOLD = 50;

    /// @dev Cap relayed ratio to prevent absurd values from malformed events.
    ///      100000 = 10x imbalance, well past MAX_FEE territory.
    uint256 private constant MAX_RELAY_RATIO = 100_000;

    /// @dev Precomputed selector for AlertReceiver.handleAlert(address,bytes32,uint256,uint256)
    ///      First param (address) is a placeholder -- Reactive Network replaces the first 32 bytes
    ///      of the callback payload (after selector) with rvm_id (deployer address).
    bytes4 private constant HANDLE_ALERT_SELECTOR =
        bytes4(keccak256("handleAlert(address,bytes32,uint256,uint256)"));

    // Event topic0 signatures
    uint256 private constant TOPIC_V3_SWAP =
        uint256(keccak256("Swap(address,address,int256,int256,uint160,uint128,int24)"));
    uint256 private constant TOPIC_V4_SWAP =
        uint256(keccak256("Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)"));
    uint256 private constant TOPIC_V2_SYNC =
        uint256(keccak256("Sync(uint112,uint112)"));

    // --- State ---
    address public owner;

    /// @dev pool address => MonitoredPool config
    mapping(address => MonitoredPool) public pools;
    address[] public poolAddresses;

    Destination[] public destinations;

    /// @dev Deduplication: keccak256(pairId, destChainId) => last sent ratio
    mapping(bytes32 => uint256) public lastSentRatio;

    // --- Events ---
    event PoolAdded(uint256 chainId, address poolAddr, bytes32 pairId, PoolType poolType);
    event DestinationAdded(uint256 chainId, address alertReceiver);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(PoolConfig[] memory _pools, DestConfig[] memory _dests) payable {
        owner = msg.sender;

        for (uint256 i = 0; i < _pools.length; i++) {
            PoolConfig memory p = _pools[i];
            pools[p.poolAddr] = MonitoredPool(p.chainId, p.poolAddr, p.pairId, p.poolType, p.poolId);
            poolAddresses.push(p.poolAddr);

            // Subscribe on RNK only (not in ReactVM)
            uint256 topic0;
            uint256 topic1 = REACTIVE_IGNORE;
            if (p.poolType == PoolType.UNISWAP_V4) {
                topic0 = TOPIC_V4_SWAP;
                topic1 = uint256(p.poolId);
            } else if (p.poolType == PoolType.UNISWAP_V3) {
                topic0 = TOPIC_V3_SWAP;
            } else {
                topic0 = TOPIC_V2_SYNC;
            }
            if (!vm) {
                service.subscribe(p.chainId, p.poolAddr, topic0, topic1, REACTIVE_IGNORE, REACTIVE_IGNORE);
            }
        }

        for (uint256 i = 0; i < _dests.length; i++) {
            destinations.push(Destination(_dests[i].chainId, _dests[i].alertReceiver));
        }
    }

    /// @notice Register a pool to monitor on a specific chain and subscribe to its events.
    function addMonitoredPool(
        uint256 chainId,
        address poolAddr,
        bytes32 pairId,
        PoolType poolType,
        bytes32 poolId
    ) external onlyOwner {
        bool isNew = pools[poolAddr].poolAddr == address(0);
        pools[poolAddr] = MonitoredPool(chainId, poolAddr, pairId, poolType, poolId);
        if (isNew) {
            poolAddresses.push(poolAddr);
        }

        // Subscribe to the appropriate event based on pool type
        uint256 topic0;
        uint256 topic1 = REACTIVE_IGNORE;
        if (poolType == PoolType.UNISWAP_V4) {
            topic0 = TOPIC_V4_SWAP;
            topic1 = uint256(poolId);
        } else if (poolType == PoolType.UNISWAP_V3) {
            topic0 = TOPIC_V3_SWAP;
        } else {
            topic0 = TOPIC_V2_SYNC;
        }

        if (!vm) {
            service.subscribe(chainId, poolAddr, topic0, topic1, REACTIVE_IGNORE, REACTIVE_IGNORE);
        }

        emit PoolAdded(chainId, poolAddr, pairId, poolType);
    }

    /// @notice Register a destination chain's AlertReceiver.
    function addDestination(uint256 chainId, address alertReceiver) external onlyOwner {
        destinations.push(Destination(chainId, alertReceiver));
        emit DestinationAdded(chainId, alertReceiver);
    }

    /// @notice Entry point called by ReactVM when a subscribed event fires.
    function react(LogRecord calldata log) external vmOnly {
        MonitoredPool storage pool = pools[log._contract];
        require(pool.poolAddr != address(0), "Unknown pool");

        uint256 ratio = _decodeRatio(log, pool.poolType);

        // Cap to prevent absurd values from malformed events
        if (ratio > MAX_RELAY_RATIO) ratio = MAX_RELAY_RATIO;

        _relayAlerts(pool, ratio);
    }

    // --- Internal: decode ratio from event data based on pool type ---

    function _decodeRatio(LogRecord calldata log, PoolType poolType) internal pure returns (uint256) {
        if (poolType == PoolType.UNISWAP_V4) {
            (,, uint160 sqrtPriceX96, uint128 liquidity,,) =
                abi.decode(log.data, (int128, int128, uint160, uint128, int24, uint24));
            return _computeRatioFromSqrtPrice(sqrtPriceX96, liquidity);
        } else if (poolType == PoolType.UNISWAP_V3) {
            (,, uint160 sqrtPriceX96, uint128 liquidity,) =
                abi.decode(log.data, (int256, int256, uint160, uint128, int24));
            return _computeRatioFromSqrtPrice(sqrtPriceX96, liquidity);
        } else {
            (uint112 reserve0, uint112 reserve1) = abi.decode(log.data, (uint112, uint112));
            return _computeRatioFromReserves(uint256(reserve0), uint256(reserve1));
        }
    }

    function _computeRatioFromSqrtPrice(uint160 sqrtPriceX96, uint128 liquidity) internal pure returns (uint256) {
        if (sqrtPriceX96 == 0) return RATIO_PRECISION;

        // When liquidity is 0 (price pushed past all LP ranges), use nominal liquidity.
        // The ratio only depends on price (sqrtPriceX96), not absolute amounts, so L cancels out.
        uint256 L = liquidity > 0 ? uint256(liquidity) : 1e18;

        uint256 reserve0 = (L * uint256(Q96)) / uint256(sqrtPriceX96);
        uint256 reserve1 = (L * uint256(sqrtPriceX96)) / uint256(Q96);

        return _computeRatioFromReserves(reserve0, reserve1);
    }

    function _computeRatioFromReserves(uint256 r0, uint256 r1) internal pure returns (uint256) {
        if (r0 == 0 || r1 == 0) return type(uint256).max;
        if (r0 >= r1) {
            return (r0 * RATIO_PRECISION) / r1;
        } else {
            return (r1 * RATIO_PRECISION) / r0;
        }
    }

    // --- Internal: relay ratio to all destination chains ---

    function _relayAlerts(MonitoredPool storage pool, uint256 ratio) internal {
        for (uint256 i = 0; i < destinations.length; i++) {
            Destination storage dest = destinations[i];

            // Skip sending alert back to the origin chain
            if (dest.chainId == pool.chainId) continue;

            _sendIfChanged(dest, pool.pairId, pool.chainId, ratio);
        }
    }

    function _sendIfChanged(
        Destination storage dest,
        bytes32 pairId,
        uint256 sourceChainId,
        uint256 ratio
    ) internal {
        bytes32 dedupeKey = keccak256(abi.encodePacked(pairId, dest.chainId));
        uint256 lastRatio = lastSentRatio[dedupeKey];

        // Only relay if ratio changed by more than threshold
        uint256 diff = ratio > lastRatio ? ratio - lastRatio : lastRatio - ratio;
        if (diff < RELAY_THRESHOLD) return;

        lastSentRatio[dedupeKey] = ratio;

        bytes memory payload = abi.encodeWithSelector(
            HANDLE_ALERT_SELECTOR,
            address(0),   // placeholder: Reactive Network replaces with rvm_id
            pairId,
            ratio,
            sourceChainId
        );

        emit Callback(dest.chainId, dest.alertReceiver, CALLBACK_GAS_LIMIT, payload);
    }

    // --- View helpers ---

    function getPoolCount() external view returns (uint256) {
        return poolAddresses.length;
    }

    function getDestinationCount() external view returns (uint256) {
        return destinations.length;
    }
}

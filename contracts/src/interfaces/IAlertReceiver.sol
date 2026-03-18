// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IAlertReceiver
/// @notice Interface for querying cross-chain depeg imbalance ratio.
///         The hook uses this to set a fee floor: if another chain's pool is depegged,
///         the local pool charges at least the same fee as if the depeg had already arrived.
interface IAlertReceiver {
    /// @notice Returns the worst active cross-chain imbalance ratio for a token pair.
    /// @param tokenA First token address of the local pair.
    /// @param tokenB Second token address of the local pair.
    /// @return ratio The source chain's imbalance ratio (10000 = balanced, 0 = no alert).
    function getCrossChainRatio(address tokenA, address tokenB) external view returns (uint256 ratio);
}

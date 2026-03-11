// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "solmate/src/tokens/ERC20.sol";

/// @notice Free-mint ERC20 for testnet demos. Anyone can mint.
contract MockStablecoin is ERC20 {
    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol, 6) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

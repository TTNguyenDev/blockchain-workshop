// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TTNguyenToken is ERC20 {
    constructor() ERC20("TTNguyen Token", "TTN") {
        _mint(msg.sender, 1000000000000000000000000000000000000000000000);
    }
}

pragma solidity ^0.8.0;

import "@openzepplin/contracts/token/ERC1155/ERC1155.sol";
import "@openzepplin/contracts/access/Ownable.sol";

contract NFTContract is ERC1155, Ownable {
	uint256 public constant SUPPLY_LIMIT = 10000;

	constructor(string memory tokenURI) public ERC1155(tokenURI) {}

	function mint(address account, uint256 id) {}
}

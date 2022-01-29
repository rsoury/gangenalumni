// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NFTManagement
 * NFT - a contract for managing accessibility to specific Tokens ids
 */
contract NFTManagement is Ownable {
	// Create a contract URI variable
	mapping(uint256 => bool) public blacklistedTokenIds;
	uint256 public constant MAX_TOKEN_COUNT = 10000;

	constructor(uint256[] memory tokenIds) {
		setBlacklistedTokenIds(tokenIds);
	}

	function setBlacklistedTokenIds(uint256[] memory tokenIds)
		public
		onlyOwner
	{
		for (uint256 i = 1; i <= MAX_TOKEN_COUNT; i++) {
			blacklistedTokenIds[i] = false;
		}
		for (uint256 i = 0; i < tokenIds.length; i++) {
			blacklistedTokenIds[tokenIds[i]] = true;
		}
	}

	// function nextAvailableToken(uint256 offset)
	// 	internal
	// 	view
	// 	returns (uint256)
	// {
	// 	uint256 token;
	// 	for (uint256 i = 1; i <= MAX_TOKEN_COUNT; i++) {
	// 		if (tokenSupply[i] == 0) {
	// 			bool isBlacklisted = false;
	// 			for (uint256 j = 0; j < _blacklistedTokenIds.length; j++) {
	// 				if (i == _blacklistedTokenIds[j]) {
	// 					isBlacklisted = true;
	// 					break;
	// 				}
	// 			}
	// 			if (isBlacklisted) {
	// 				continue;
	// 			}
	// 			if (offset > 0) {
	// 				offset = offset - 1;
	// 				continue;
	// 			}
	// 			token = i;
	// 			break;
	// 		}
	// 	}
	// 	return token;
	// }

	// function nextAvailableToken() internal view returns (uint256) {
	// 	return nextAvailableToken(0);
	// }
}

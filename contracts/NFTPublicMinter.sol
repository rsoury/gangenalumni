// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./NFT.sol";

/**
 * @title NFTPublicMinter
 * NFTPublicMinter - a contract for managing accessibility to specific Tokens ids
 */
contract NFTPublicMinter is Ownable {
	address private _nftAddress;
	string private _defaultPublicMintCustomURI;
	mapping(uint256 => bool) public _blacklistedTokenIds;
	uint256 public constant PRICE = 0.1 ether;
	uint256 public constant MAX_TOKEN_COUNT = 10000;

	constructor(address nftAddress) {
		_nftAddress = nftAddress;
	}

	function setDefaultPublicMintCustomURI(string memory newuri)
		public
		onlyOwner
	{
		_defaultPublicMintCustomURI = newuri;
	}

	function setBlacklistedTokenIds(uint256[] memory tokenIds)
		public
		onlyOwner
	{
		for (uint256 i = 1; i <= MAX_TOKEN_COUNT; i++) {
			if (_blacklistedTokenIds[i]) {
				_blacklistedTokenIds[i] = false;
			}
		}
		for (uint256 i = 0; i < tokenIds.length; i++) {
			_blacklistedTokenIds[tokenIds[i]] = true;
		}
	}

	function isBlacklisted(uint256 id) public view returns (bool) {
		return _blacklistedTokenIds[id];
	}

	/**
	 * @dev Publicly accessible: Mint new tokens to the contract caller based on the amount of value sent.
	 * Each token value is hard coded
	 */
	function publicMint(uint256[] memory ids) public payable {
		require(
			msg.value == PRICE * ids.length,
			"NFTPublicMinter: invalid value"
		);
		require(
			ids.length > 0,
			"NFTPublicMinter: mint amount must be greater than 0"
		);
		address initialOwner = _msgSender();
		string memory uri = _defaultPublicMintCustomURI;
		NFT nft = NFT(_nftAddress);
		if (ids.length > 1) {
			// Batch Mint
			for (uint256 i = 0; i < ids.length; i++) {
				uint256 id = ids[i];
				require(
					_blacklistedTokenIds[id] == false,
					"NFTPublicMinter: Cannot mint blacklisted Token Id"
				);
				ids[i] = id;
			}
			nft.batchMint(initialOwner, ids, uri, "");
		} else {
			// Single Mint
			uint256 id = ids[0];
			require(
				_blacklistedTokenIds[id] == false,
				"NFTPublicMinter: Cannot mint blacklisted Token Id"
			);
			nft.mint(initialOwner, id, uri, "");
		}
	}

	/**
	 * @dev Withdraw funds used to publicly mint tokens
	 */
	function withdraw(address payable payee) public onlyOwner {
		// send all Ether to payee
		(bool sent, ) = payee.call{ value: address(this).balance }("");
		require(sent, "Failed to withdraw Ether");
	}
}

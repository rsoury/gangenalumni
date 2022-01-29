// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ERC1155Tradable.sol";

/**
 * @title NFT
 * NFT - a contract for non-fungible tokens using ERC 1155 for batch actions
 */
contract NFT is ERC1155Tradable {
	// Create a contract URI variable
	string private _contractURI;
	uint256 public constant MAX_TOKEN_COUNT = 10000;

	event PermanentURI(string _value, uint256 indexed _id);

	constructor(
		address _proxyRegistryAddress,
		string memory name,
		string memory symbol,
		string memory cURI,
		string memory tokenURI,
		address publicMinter
	)
		ERC1155Tradable(
			name,
			symbol,
			tokenURI,
			_proxyRegistryAddress,
			publicMinter
		)
	{
		_contractURI = cURI;
	}

	function contractURI() public view returns (string memory) {
		return _contractURI;
	}

	function setContractURI(string memory newuri) public onlyOwner {
		_contractURI = newuri;
	}

	/**
	 * @dev Mint a new token to an address
	 * @param initialOwner          The address to mint tokens to
	 * @param id                    Token ID to mint for owner.
	 * @param uri                    The Custom URI to set against each newly created Token
	 * @param data                   Data to pass if receiver is contract
	 */
	function mint(
		address initialOwner,
		uint256 id,
		string memory uri,
		bytes memory data
	) public onlyOwnerOrMinter returns (uint256) {
		_prepareToken(id, uri);
		_mint(initialOwner, id, 1, data);
		return id;
	}

	/**
	 * @dev Mint new tokens to an address for each id in _ids
	 * @param initialOwner          The address to mint tokens to
	 * @param ids            Array of ids to mint for owner.
	 * @param uri                    The Custom URI to set against each newly created Token
	 * @param data                   Data to pass if receiver is contract
	 */
	function batchMint(
		address initialOwner,
		uint256[] memory ids,
		string memory uri,
		bytes memory data
	) public onlyOwnerOrMinter {
		uint256[] memory quantities = new uint256[](ids.length); // https://fravoll.github.io/solidity-patterns/memory_array_building.html
		for (uint256 j = 0; j < ids.length; j++) {
			uint256 id = ids[j];
			_prepareToken(id, uri);
			quantities[j] = 1;
		}
		_mintBatch(initialOwner, ids, quantities, data);
	}

	/**
	 * @dev Batch mint new tokens to many addresses
	 * @param initialOwners          The addresses to mint tokens to
	 * @param idsPerOwner            2d Array of ids to mint for each owner. Required to be the same length as initialOwners.
	 * @param uri                    The Custom URI to set against each newly created Token
	 * @param data                   Data to pass if receiver is contract
	 */
	function batchMintToMany(
		address[] memory initialOwners,
		uint256[][] memory idsPerOwner,
		string memory uri,
		bytes memory data
	) public {
		require(
			initialOwners.length == idsPerOwner.length,
			"NFT: initialOwners and idsPerOwner length mismatch"
		);
		for (uint256 i = 0; i < initialOwners.length; i++) {
			address initialOwner = initialOwners[i];
			uint256[] memory ids = idsPerOwner[i];
			batchMint(initialOwner, ids, uri, data);
		}
	}

	/**
		Allows contract owner to mass transfer to many recipients in a single transaction
	 */
	function batchTransferToMany(
		address from,
		address[] memory recipients,
		uint256[][] memory idsPerRecipient
	) public {
		for (uint256 i = 0; i < recipients.length; i++) {
			address recipient = recipients[i];
			uint256[] memory ids = idsPerRecipient[i];
			uint256[] memory quantities = new uint256[](ids.length);
			for (uint256 j = 0; j < ids.length; j++) {
				uint256 quantity = balanceOf(from, ids[j]);
				quantities[j] = quantity;
			}
			bytes memory data = "";
			safeBatchTransferFrom(from, recipient, ids, quantities, data);
		}
	}

	/**
		Mark a single token as permanent in batch
	 */
	function makePermanent(uint256 id) public onlyOwner {
		require(_exists(id), "token id does not exist");
		string memory tokenURI = uri(id);
		emit PermanentURI(tokenURI, id);
	}

	/**
		Mark all tokens permanent in batch
	 */
	function batchMakePermanent(uint256[] memory ids) public {
		for (uint256 i = 0; i < ids.length; i++) {
			makePermanent(ids[i]);
		}
	}

	function batchSetCustomURI(uint256[] memory tokenIds, string memory newuri)
		public
	{
		for (uint256 i = 0; i < tokenIds.length; i++) {
			setCustomURI(tokenIds[i], newuri);
		}
	}

	function _prepareToken(uint256 id, string memory uri) private {
		require(!_exists(id), "token id already exists");
		require(id > 0 && id <= MAX_TOKEN_COUNT, "token id out of bounds");

		if (bytes(uri).length > 0) {
			customUri[id] = uri;
			emit URI(uri, id);
		}

		tokenSupply[id] = 1;
	}
}

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
	uint256 public _price = 0.1 ether;

	uint256 public constant MAX_TOKEN_COUNT = 10000;

	event PermanentURI(string _value, uint256 indexed _id);

	constructor(
		address _proxyRegistryAddress,
		string memory name,
		string memory symbol,
		string memory cURI,
		string memory tokenURI
	) ERC1155Tradable(name, symbol, tokenURI, _proxyRegistryAddress) {
		_contractURI = cURI;
	}

	function contractURI() public view returns (string memory) {
		return _contractURI;
	}

	function setContractURI(string memory newuri) public onlyOwner {
		_contractURI = newuri;
	}

	/**
	 * @dev Mint a new token type and assigns _initialSupply to an address
	 * @param initialOwner address of the first owner of the token
	 * @param id The id of the token to create (must not currenty exist).
	 * @param uri Optional URI for this token type
	 * @param data Data to pass if receiver is contract
	 * @return The newly created token ID
	 */
	function mint(
		address initialOwner,
		uint256 id,
		string memory uri,
		bytes memory data
	) public onlyOwner returns (uint256) {
		require(!_exists(id), "token id already exists");

		if (bytes(uri).length > 0) {
			customUri[id] = uri;
			emit URI(uri, id);
		}

		_mint(initialOwner, id, 1, data);

		tokenSupply[id] = 1;

		return id;
	}

	/**
	 * @dev Mint new tokens for each id in _ids
	 * @param initialOwners          The addresses to mint tokens to
	 * @param idsPerOwner            2d Array of ids to mint for each owner. Required to be the same length as initialOwners.
	 * @param uri                    The Custom URI to set against each newly created Token
	 * @param data                   Data to pass if receiver is contract
	 */
	function batchMint(
		address[] memory initialOwners,
		uint256[][] memory idsPerOwner,
		string memory uri,
		bytes memory data
	) public onlyOwner {
		require(
			initialOwners.length == idsPerOwner.length,
			"NFT: initialOwners and idsPerOwner length mismatch"
		);
		for (uint256 i = 0; i < initialOwners.length; i++) {
			address initialOwner = initialOwners[i];
			uint256[] memory ids = idsPerOwner[i];
			uint256[] memory quantities = new uint256[](ids.length); // https://fravoll.github.io/solidity-patterns/memory_array_building.html
			for (uint256 j = 0; j < ids.length; j++) {
				uint256 id = ids[i];
				require(!_exists(id), "token id already exists");
				tokenSupply[id] = 1;
				quantities[i] = 1;

				if (bytes(uri).length > 0) {
					customUri[id] = uri;
					emit URI(uri, id);
				}
			}
			_mintBatch(initialOwner, ids, quantities, data);
		}
	}

	/**
	 * @dev Publicly accessible: Mint new tokens to the contract caller based on the amount of value sent.
	 * Each token value is hard coded
	 */
	function publicMint(uint256 count) public payable {
		require(msg.value == _price * count, "NFT: invalid value");
		require(count > 0, "NFT: mint amount must be greater than 0");
		require(count <= 100, "NFT: public mint amount must be less than 100");
		address initialOwner = _msgSender();
		if (count > 1) {
			// Batch Mint
			uint256[] memory ids = new uint256[](count);
			uint256[] memory quantities = new uint256[](count);
			for (uint256 i = 0; i < count; i++) {
				uint256 id = nextAvailableToken(i);
				require(id > 0, "no more tokens available to publicly mint");
				require(!_exists(id), "token id already exists");
				ids[i] = id;
				quantities[i] = 1;
				tokenSupply[id] = 1;
			}
			_mintBatch(initialOwner, ids, quantities, "");
		} else {
			// Single Mint
			uint256 id = nextAvailableToken();
			require(id > 0, "no more tokens available to publicly mint");
			require(!_exists(id), "token id already exists");

			_mint(initialOwner, id, 1, "");

			tokenSupply[id] = 1;
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
				uint256 quantity = super.balanceOf(from, ids[j]);
				quantities[j] = quantity;
			}
			bytes memory data = "";
			super.safeBatchTransferFrom(from, recipient, ids, quantities, data);
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

	function nextAvailableToken(uint256 offset)
		internal
		view
		returns (uint256)
	{
		uint256 token;
		for (uint256 i = 1; i <= MAX_TOKEN_COUNT; i++) {
			if (tokenSupply[i] == 0) {
				if (offset > 0) {
					offset = offset - 1;
				} else {
					token = i;
					break;
				}
			}
		}
		return token;
	}

	function nextAvailableToken() internal view returns (uint256) {
		return nextAvailableToken(0);
	}
}

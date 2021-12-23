// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ERC1155Tradable.sol";

/**
 * @title NFTContract
 * NFTContract - a contract for non-fungible tokens using ERC 1155 for batch actions
 */
contract NFTContract is ERC1155Tradable {
	// Create a contract URI variable
	string private _contractURI;

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

	/*
		Allows contract owner to mass create tokens and issue to initialOwners addresses in a single transaction
	*/
	function batchCreate(address[] memory initialOwners, uint256[][] memory ids)
		public
	{
		for (uint256 i = 0; i < initialOwners.length; i++) {
			address initialOwner = initialOwners[i];
			uint256[] memory ownersIds = ids[i];
			for (uint256 j = 0; j < ownersIds.length; i++) {
				uint256 id = ownersIds[j];
				uint256 quantity = 1;

				super.create(initialOwner, id, quantity, "", "");
			}
		}
	}

	/**
		Allows contract owner to mass transfer to many recipients in a single transaction
	 */
	function batchTransferToMany(
		address from,
		address[] memory recipients,
		uint256[][] memory idsPerRecipient
	) public onlyOwner {
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
}

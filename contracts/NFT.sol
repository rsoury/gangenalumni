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
	function batchCreate(
		address[] memory initialOwners,
		uint256[][] memory ids,
		uint256[][] memory quantities,
		string[][] memory uris,
		bytes[][] memory datas
	) public {
		for (uint256 i = 0; i < initialOwners.length; i++) {
			address initialOwner = initialOwners[i];
			uint256[] memory ownersIds = ids[i];
			uint256[] memory ownersQuantities = quantities[i];
			string[] memory ownersTokenUris = uris[i];
			bytes[] memory ownersDatas = datas[i];
			for (uint256 j = 0; j < ownersIds.length; i++) {
				uint256 id = ownersIds[j];
				uint256 quantity = ownersQuantities[i];
				string memory uri = ownersTokenUris[i];
				bytes memory data = ownersDatas[i];

				super.create(initialOwner, id, quantity, uri, data);
			}
		}
	}

	/**
		Allows contract owner to mass transfer to many recipients in a single transaction
	 */
	function batchTransferToMany(
		address from,
		address[] memory recipients,
		uint256[][] memory ids,
		uint256[][] memory quantities,
		bytes[] memory datas
	) public onlyOwner {
		for (uint256 i = 0; i < recipients.length; i++) {
			address recipient = recipients[i];
			uint256[] memory recipientIds = ids[i];
			uint256[] memory recipientQuantities = quantities[i];
			bytes memory recipientData = datas[i];
			super.safeBatchTransferFrom(
				from,
				recipient,
				recipientIds,
				recipientQuantities,
				recipientData
			);
		}
	}
}

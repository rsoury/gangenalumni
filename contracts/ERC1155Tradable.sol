// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./common/meta-transactions/ContentMixin.sol";
import "./common/meta-transactions/NativeMetaTransaction.sol";

contract OwnableDelegateProxy {}

contract ProxyRegistry {
	mapping(address => OwnableDelegateProxy) public proxies;
}

/**
 * @title ERC1155Tradable
 * ERC1155Tradable - ERC1155 contract that whitelists an operator address, has create and mint functionality, and supports useful standards from OpenZeppelin,
  like _exists(), name(), symbol(), and totalSupply()
 */
contract ERC1155Tradable is
	ContextMixin,
	ERC1155,
	NativeMetaTransaction,
	Ownable
{
	using Strings for string;
	using SafeMath for uint256;

	address proxyRegistryAddress;
	mapping(uint256 => uint256) public tokenSupply;
	mapping(uint256 => string) customUri;
	// Contract name
	string public name;
	// Contract symbol
	string public symbol;
	address _minterAddress;

	constructor(
		string memory _name,
		string memory _symbol,
		string memory _uri,
		address _proxyRegistryAddress
	) ERC1155(_uri) {
		name = _name;
		symbol = _symbol;
		proxyRegistryAddress = _proxyRegistryAddress;
		_initializeEIP712(name);
	}

	/**
	 * @dev Throws if called by any account other than the owner.
	 */
	modifier onlyOwnerOrMinter() {
		address sender = _msgSender();
		require(
			owner() == sender || _minterAddress == sender,
			"ERC1155Tradable: caller is not the owner or a minter"
		);
		_;
	}

	function setMinter(address minter) public onlyOwner {
		_minterAddress = minter;
	}

	function uri(uint256 _id) public view override returns (string memory) {
		require(_exists(_id), "ERC1155Tradable#uri: NONEXISTENT_TOKEN");
		// We have to convert string to bytes to check for existence
		bytes memory customUriBytes = bytes(customUri[_id]);
		if (customUriBytes.length > 0) {
			return customUri[_id];
		} else {
			return super.uri(_id);
		}
	}

	/**
	 * @dev Returns the total quantity for a token ID
	 * @param _id uint256 ID of the token to query
	 * @return amount of token in existence
	 */
	function totalSupply(uint256 _id) public view returns (uint256) {
		return tokenSupply[_id];
	}

	/**
	 * @dev Sets a new URI for all token types, by relying on the token type ID
	 * substitution mechanism
	 * https://eips.ethereum.org/EIPS/eip-1155#metadata[defined in the EIP].
	 * @param _newURI New URI for all tokens
	 */
	function setURI(string memory _newURI) public onlyOwner {
		_setURI(_newURI);
	}

	/**
	 * @dev Will update the base URI for the token
	 * @param _tokenId The token to update. _msgSender() must be its creator.
	 * @param _newURI New URI for the token.
	 */
	function setCustomURI(uint256 _tokenId, string memory _newURI)
		public
		onlyOwner
	{
		customUri[_tokenId] = _newURI;
		emit URI(_newURI, _tokenId);
	}

	/**
	 * Override isApprovedForAll to whitelist user's OpenSea proxy accounts to enable gas-free listings.
	 */
	function isApprovedForAll(address _owner, address _operator)
		public
		view
		override
		returns (bool isOperator)
	{
		// Whitelist OpenSea proxy contract for easy trading.
		ProxyRegistry proxyRegistry = ProxyRegistry(proxyRegistryAddress);
		if (address(proxyRegistry.proxies(_owner)) == _operator) {
			return true;
		}

		return ERC1155.isApprovedForAll(_owner, _operator);
	}

	/**
	 * @dev Returns whether the specified token exists by checking to see if it has a creator
	 * @param _id uint256 ID of the token to query the existence of
	 * @return bool whether the token exists
	 */
	function _exists(uint256 _id) internal view returns (bool) {
		return tokenSupply[_id] > 0;
	}

	function exists(uint256 _id) external view returns (bool) {
		return _exists(_id);
	}

	/**
	 * This is used instead of msg.sender as transactions won't be sent by the original token owner, but by OpenSea.
	 */
	function _msgSender() internal view override returns (address sender) {
		return ContextMixin.msgSender();
	}
}

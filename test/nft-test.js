const { expect } = require("chai");
const { ethers } = require("hardhat");

let nft;

describe("NFT Smart Contract Tests", () => {
	this.beforeEach(async () => {
		// This is executed before each test
		const NFT = await ethers.getContractFactory("NFT");
		const nft = await NFT.deploy("", "Gangen Alumni", "GANGA", "", "");
	});

	it("NFT is created successfully", async () => {});

	it("Token URI is set sucessfully", async () => {});
});

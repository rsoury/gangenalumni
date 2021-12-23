const { expect } = require("chai");
const { ethers } = require("hardhat");

let nft;
const tokenURI =
	"https://gangenalumni.s3.us-east-2.amazonaws.com/rinkeby/data/{id}.json";
const contractURI =
	"https://gangenalumni.s3.us-east-2.amazonaws.com/rinkeby/data/contract.json";

describe("NFT Smart Contract Tests", () => {
	this.beforeEach(async () => {
		// This is executed before each test
		const NFT = await ethers.getContractFactory("NFT");
		nft = await NFT.deploy("", "Gangen Alumni", "GANGA", contractURI, tokenURI);
	});

	it("NFT is created successfully", async () => {
		const [account1] = await ethers.getSigners();
		expect(await nft.balanceOf(account1.address)).to.equal(0);

		await nft.connect(account1).create(account1.address, 1, 1);
		expect(await nft.balanceOf(account1.address)).to.equal(1);
	});

	it("Token/Contract URI is set sucessfully", async () => {
		expect(await nft.contractURI()).to.equal(contractURI);
		expect(await nft.uri(1)).to.equal(tokenURI);
	});
});

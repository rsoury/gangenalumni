const { expect } = require("chai");
const { ethers } = require("hardhat");

let nft;
const tokenURI =
	"https://gangenalumni.s3.us-east-2.amazonaws.com/rinkeby/data/{id}.json";
const contractURI =
	"https://gangenalumni.s3.us-east-2.amazonaws.com/rinkeby/data/contract.json";

describe("NFT Smart Contract Tests", () => {
	beforeEach(async () => {
		// This is executed before each test
		const NFT = await ethers.getContractFactory("NFT");
		const MockProxyRegistry = await ethers.getContractFactory(
			"MockProxyRegistry"
		);
		const mockProxyRegistry = await MockProxyRegistry.deploy();
		nft = await NFT.deploy(
			mockProxyRegistry.address,
			"Gangen Alumni",
			"GANGA",
			contractURI,
			tokenURI
		);
	});

	it("NFT token is created successfully", async () => {
		const [owner] = await ethers.getSigners();
		expect(await nft.balanceOf(owner.address, 1)).to.equal(0);

		await nft.connect(owner).create(owner.address, 1, 1, "", []);
		expect(await nft.balanceOf(owner.address, 1)).to.equal(1);
	});

	it("Token/Contract URI is set sucessfully", async () => {
		expect(await nft.contractURI()).to.equal(contractURI);
		const [owner] = await ethers.getSigners();
		await nft.connect(owner).create(owner.address, 1, 1, "", []);
		expect(await nft.uri(1)).to.equal(tokenURI);
	});
});

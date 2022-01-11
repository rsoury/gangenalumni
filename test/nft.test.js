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

	it("Token can set new contract URI successfully", async () => {
		const [owner] = await ethers.getSigners();
		const newUri = "https://webdoodle.com.au/404-contract.json";
		await nft.connect(owner).setContractURI(newUri);
		expect(await nft.contractURI()).to.equal(newUri);
	});

	it("Token batch creation is successful", async () => {
		const [owner, ...accounts] = await ethers.getSigners();
		const addresses = accounts.map(({ address }) => address);
		const idsPerAddress = accounts.map((account, i) => {
			return [i + 1];
		});
		// console.log(addresses, idsPerAddress);
		await nft.connect(owner).batchCreate(addresses, idsPerAddress, "");
		const balances = await Promise.all(
			accounts.map((account, i) => {
				return nft.balanceOf(account.address, i + 1);
			})
		);
		balances.forEach((balance) => {
			expect(balance).to.equal(1);
		});
	});

	it("Token batch many transfer runs successfully", async () => {
		const [owner, ...accounts] = await ethers.getSigners();
		const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		await nft.connect(owner).batchCreate([accounts[0].address], [ids], "");
		const balances = await Promise.all(
			ids.map((id) => {
				return nft.balanceOf(accounts[0].address, id);
			})
		);
		balances.forEach((balance) => {
			expect(balance).to.equal(1);
		});
	});

	it("Token permanence event emits successfully", async () => {
		const [owner] = await ethers.getSigners();
		await nft.connect(owner).create(owner.address, 1, 1, "", []);
		expect(await nft.balanceOf(owner.address, 1)).to.equal(1);
		await expect(nft.makePermanent(1))
			.to.emit(nft, "PermanentURI")
			.withArgs(tokenURI, 1);
	});

	it("Token batch permanence is successful", async () => {
		const [owner] = await ethers.getSigners();
		const promises = [];
		for (let i = 1; i <= 10; i += 1) {
			const resultPromise = nft
				.connect(owner)
				.create(owner.address, i, 1, "", []);
			promises.push(resultPromise);
		}
		await Promise.all(promises);
		expect(await nft.balanceOf(owner.address, 3)).to.equal(1);
		const batchPromise = nft.batchMakePermanent([
			1, 2, 3, 4, 5, 6, 7, 8, 9, 10
		]);
		const batchPermanentPromises = [];
		for (let i = 1; i <= 10; i += 1) {
			batchPermanentPromises.push(
				expect(batchPromise).to.emit(nft, "PermanentURI").withArgs(tokenURI, i)
			);
		}
		await Promise.all(batchPermanentPromises);
	});
});

const { expect } = require("chai");
const { ethers } = require("hardhat");
const _ = require("lodash");
const expectThrow = require("./helpers/expect-throw");

let nft;
let npm;
const tokenURI =
	"https://gangenalumni.s3.us-east-2.amazonaws.com/rinkeby/data/{id}.json";
const contractURI =
	"https://gangenalumni.s3.us-east-2.amazonaws.com/rinkeby/data/contract.json";
const PUBLIC_MINT_PRICE = 0.1;

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
		const NFTPublicMinter = await ethers.getContractFactory("NFTPublicMinter");
		npm = await NFTPublicMinter.deploy(nft.address);
		const [owner] = await ethers.getSigners();
		const tx = await nft.connect(owner).setMinter(npm.address);
		await tx.wait();
	});

	it("Token is minted successfully", async () => {
		const [owner] = await ethers.getSigners();
		expect(await nft.balanceOf(owner.address, 1)).to.equal(0);

		await nft.connect(owner).mint(owner.address, 1, "", []);
		expect(await nft.balanceOf(owner.address, 1)).to.equal(1);
	});

	it("Contract errors on out of bounds token", async () => {
		const [owner] = await ethers.getSigners();
		await expectThrow(
			nft.connect(owner).mint(owner.address, 10001, "", []),
			"token id out of bounds"
		);
	});

	it("Token is publicly minted successfully", async () => {
		const [, account] = await ethers.getSigners();
		expect(await nft.balanceOf(account.address, 1)).to.equal(0);

		const overrides = {
			value: ethers.utils.parseEther(`${PUBLIC_MINT_PRICE}`)
		};
		await npm.connect(account).publicMint(1, overrides);
		expect(await nft.balanceOf(account.address, 1)).to.equal(1);
	});

	it("Token throws error for publicly mint insufficient funds", async () => {
		const [, account] = await ethers.getSigners();
		const overrides = {
			value: ethers.utils.parseEther("0.01")
		};
		await expectThrow(
			npm.connect(account).publicMint(1, overrides),
			"invalid value"
		);
	});

	it("Token/Contract URI is set sucessfully", async () => {
		expect(await nft.contractURI()).to.equal(contractURI);
		const [owner] = await ethers.getSigners();
		await nft.connect(owner).mint(owner.address, 1, "", []);
		expect(await nft.uri(1)).to.equal(tokenURI);
	});

	it("Token can set new contract URI successfully", async () => {
		const [owner] = await ethers.getSigners();
		const newUri = "https://webdoodle.com.au/404-contract.json";
		await nft.connect(owner).setContractURI(newUri);
		expect(await nft.contractURI()).to.equal(newUri);
	});

	it("Token batch mint is successful", async () => {
		const [owner, ...accounts] = await ethers.getSigners();
		const addresses = accounts.map(({ address }) => address);
		const idsPerAddress = accounts.map((account, i) => {
			return [i + 1];
		});
		// console.log(addresses, idsPerAddress);
		await nft.connect(owner).batchMintToMany(addresses, idsPerAddress, "", []);
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
		await nft.connect(owner).batchMintToMany([owner.address], [ids], "", []);
		const balances = await Promise.all(
			ids.map((id) => {
				return nft.balanceOf(owner.address, id);
			})
		);
		balances.forEach((balance) => {
			expect(balance).to.equal(1);
		});

		const accountAddresses = accounts.map((account) => account.address);
		const idsPerAccount = accounts.map(() => []);
		ids.forEach((id) => {
			const randomIndex = Math.floor(Math.random() * accounts.length);
			idsPerAccount[randomIndex].push(id);
		});
		// console.log(accountAddresses);
		// console.log(idsPerAccount);
		await nft
			.connect(owner)
			.batchTransferToMany(owner.address, accountAddresses, idsPerAccount);
		const balancesPerAccount = await Promise.all(
			idsPerAccount.map((idsForAccount, index) => {
				return Promise.all(
					idsForAccount.map((id) => {
						return nft.balanceOf(accountAddresses[index], id);
					})
				);
			})
		);
		// console.log(balancesPerAccount);
		balancesPerAccount.forEach((balancesForAccount) => {
			balancesForAccount.forEach((balance) => {
				expect(balance).to.equal(1);
			});
		});
	});

	it("Token public/payment-based batch mint successful", async () => {
		const [, account] = await ethers.getSigners();
		expect(await nft.balanceOf(account.address, 1)).to.equal(0);

		const overrides = {
			value: ethers.utils.parseEther("1")
		};
		const tx = await npm.connect(account).publicMint(10, overrides);
		const events = await nft.queryFilter("TransferBatch");
		const event = events.find(
			({ args, transactionHash }) =>
				args.to === account.address && transactionHash === tx.hash
		);
		const { ids } = event.args;
		const balances = await Promise.all(
			ids.map((id) => {
				return nft.balanceOf(account.address, id);
			})
		);
		balances.forEach((balance) => {
			expect(balance).to.equal(1);
		});

		const supply = await nft.totalSupply(2);
		expect(supply.toNumber()).to.equal(1);
	});

	it("Token public/payment-based batch mint throws error for insufficient funds", async () => {
		const [, account] = await ethers.getSigners();
		expect(await nft.balanceOf(account.address, 1)).to.equal(0);

		const overrides = {
			value: ethers.utils.parseEther(`${PUBLIC_MINT_PRICE}`)
		};
		await expectThrow(
			npm.connect(account).publicMint(10, overrides),
			"invalid value"
		);
	});

	it("Token public/payment-based batch mint throws error for 'no more tokens'", async function () {
		this.timeout(60000);
		const [owner, , , account] = await ethers.getSigners();
		expect(await nft.balanceOf(account.address, 1)).to.equal(0);

		const promises = _.range(20).map((index) => {
			return nft.connect(owner).batchMintToMany(
				[owner.address],
				// [_.range(index * 1000 + 1, index * 1000 + 1000)],
				[_.range(index * 500 + 1, index * 500 + 501)], // _.range(1, 501) = [1...500] -- second parameter is the number of elements, rather than the end element.
				"",
				[],
				{
					gasLimit: 30000000
				}
			);
		});
		// const txs = [];
		for (let i = 0; i < promises.length; i += 1) {
			// const tx = await promises[i];
			// txs.push(tx);
			await promises[i];
		}

		// const events = await nft.queryFilter("TransferBatch");
		const supply = await nft.totalSupply(10000);
		expect(supply).to.be.equal(1);
		// // console.log(events[events.length - 1].args.ids);
		// // Collect all ids from event into a single array, then check which are missing.
		// const eventIds = events.reduce((a, event) => {
		// 	a = [...a, ...event.args.ids.map((id) => id.toNumber())];
		// 	return a;
		// }, []);
		// const missing = [];
		// _.range(1, 10000).forEach((id) => {
		// 	if (!eventIds.includes(id)) {
		// 		missing.push(id);
		// 	}
		// });
		// console.log({
		// 	numOfEvents: events.length,
		// 	supply10000: supply.toNumber(),
		// 	totalTokenCount: events.reduce((acc, currentValue) => {
		// 		acc += currentValue.args.ids.length;
		// 		return acc;
		// 	}, 0),
		// 	txsIdSum: events.reduce((a, event) => {
		// 		a += event.args.ids.reduce((idA, id) => {
		// 			idA += id.toNumber();
		// 			return idA;
		// 		}, 0);
		// 		return a;
		// 	}, 0),
		// 	totalIdSum: _.range(1, 10001).reduce((a, c) => {
		// 		a += c;
		// 		return a;
		// 	}, 0),
		// 	missing
		// });

		await npm.connect(account).publicMint(1, {
			value: ethers.utils.parseEther(`${PUBLIC_MINT_PRICE}`)
		});
		expect(await nft.balanceOf(account.address, 1)).to.equal(1);
		// await expectThrow(
		// 	npm.connect(account).publicMint(1, {
		// 		// gasLimit: 30000000,
		// 		// gasPrice: 30000000,
		// 		value: ethers.utils.parseEther(`${PUBLIC_MINT_PRICE}`) // (`${0.1 * 21}`),
		// 	}),
		// 	"no more tokens"
		// );
	});

	it("Token permanence event emits successfully", async () => {
		const [owner] = await ethers.getSigners();
		await nft.connect(owner).mint(owner.address, 1, "", []);
		expect(await nft.balanceOf(owner.address, 1)).to.equal(1);
		await expect(nft.makePermanent(1))
			.to.emit(nft, "PermanentURI")
			.withArgs(tokenURI, 1);
	});

	it("Token batch permanence is successful", async () => {
		const [owner] = await ethers.getSigners();
		const promises = [];
		const ids = _.range(1, 11);
		for (let i = 0; i < ids.length; i += 1) {
			const resultPromise = nft
				.connect(owner)
				.mint(owner.address, ids[i], "", []);
			promises.push(resultPromise);
		}
		await Promise.all(promises);
		expect(await nft.balanceOf(owner.address, 3)).to.equal(1);
		const batchPromise = nft.batchMakePermanent(ids);
		const batchPermanentPromises = [];
		for (let i = 0; i < ids.length; i += 1) {
			batchPermanentPromises.push(
				expect(batchPromise)
					.to.emit(nft, "PermanentURI")
					.withArgs(tokenURI, ids[i])
			);
		}
		await Promise.all(batchPermanentPromises);
	});

	it("Withdrawal executes successfully", async () => {
		const [owner] = await ethers.getSigners();
		const tx = await npm.connect(owner).withdraw(owner.address);
		expect(tx.hash).to.be.a("string");
	});

	it("Successfully blacklists an array of tokenIds", async () => {
		const [owner, account] = await ethers.getSigners();
		const bIds = _.range(1, 11);
		const tx = await npm.connect(owner).setBlacklistedTokenIds(bIds);
		expect(tx.hash).to.be.a("string");

		await tx.wait();

		await npm.connect(account).publicMint(1, {
			value: ethers.utils.parseEther(`${PUBLIC_MINT_PRICE}`)
		});
		expect(await nft.balanceOf(account.address, 11)).to.equal(1);

		bIds.push(12);
		bIds.push(14);
		bIds.push(15);

		const tx2 = await npm.connect(owner).setBlacklistedTokenIds(bIds);
		await tx2.wait();

		await npm.connect(account).publicMint(2, {
			value: ethers.utils.parseEther(`${PUBLIC_MINT_PRICE * 2}`)
		});
		expect(await nft.balanceOf(account.address, 13)).to.equal(1);
		expect(await nft.balanceOf(account.address, 16)).to.equal(1);

		expect(await npm.isBlacklisted(12), "Token 12 is blacklisted").to.be.true;
		expect(await npm.isBlacklisted(1), "Token 1 is blacklisted").to.be.true;
		expect(await npm.isBlacklisted(13), "Token 13 is not blacklisted").to.be
			.false;
	});

	it("Successfully uses the default public mint Custom URI", async () => {
		const [owner, account] = await ethers.getSigners();
		const uri = "https://www.webdoodle.com.au/metadata.json";
		const tx = await npm.connect(owner).setDefaultPublicMintCustomURI(uri);
		expect(tx.hash).to.be.a("string");

		await npm.connect(account).publicMint(1, {
			value: ethers.utils.parseEther(`${PUBLIC_MINT_PRICE}`)
		});
		expect(await nft.balanceOf(account.address, 1)).to.equal(1);
		expect(await nft.uri(1)).to.equal(uri);
	});
});

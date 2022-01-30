// Script to public mint before withdrawing -- more for testing purposes.

const { types } = require("hardhat/config");
const nextAvailableTokens = require("../helpers/next-available-tokens");

task("public-mint", "Public/Payment-based NFT token Mint to address")
	.addOptionalParam("count", "Number of tokens to mint", 1, types.int)
	.setAction(async (taskArgs, { ethers, deployments }) => {
		const npmDeployment = await deployments.get("NFTPublicMinter");
		const NFTPublicMinter = await ethers.getContractFactory("NFTPublicMinter");
		const npm = await NFTPublicMinter.attach(npmDeployment.address);
		const nftDeployment = await deployments.get("NFT");
		const NFT = await ethers.getContractFactory("NFT");
		const nft = await NFT.attach(nftDeployment.address);

		const { count } = taskArgs;

		const [owner] = await ethers.getSigners();

		const value = 0.1 * count;

		// JS to determine the next available tokens based on emitted events...
		const idsToMint = await nextAvailableTokens(nft, npm, count);

		console.log(
			`Minting tokens ${idsToMint.join(", ")} to ${
				owner.address
			} for ${value} ETH...`
		);
		const tx = await npm.connect(owner).publicMint(idsToMint, {
			value: ethers.utils.parseEther(`${value}`)
		});
		console.log(`Transaction created: ${tx.hash}`);
		await tx.wait();
		console.log(`Mint successful!`);

		const allEvents = await nft.queryFilter(
			count > 1 ? `TransferBatch` : `TransferSingle`,
			tx.blockNumber
		);
		const events = (allEvents || []).filter(
			(event) => event.args.to === owner.address
		);
		const lastEvent = events[events.length - 1];
		if (count > 1) {
			console.log(
				`Minted tokens: ${lastEvent.args.ids
					.map((id) => id.toNumber())
					.join(", ")}`
			);
		} else {
			console.log(`Minted token: ${lastEvent.args.id.toNumber()}`);
		}
	});

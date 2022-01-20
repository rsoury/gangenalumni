// Script to public mint before withdrawing -- more for testing purposes.

const _ = require("lodash");

task("public-mint", "Public/Payment-based NFT token Mint to address")
	.addOptionalParam("count", "Number of tokens to mint", "1")
	.setAction(async (taskArgs, { ethers, deployments }) => {
		const nftDeployment = await deployments.get("NFT");
		const NFT = await ethers.getContractFactory("NFT");
		const nft = await NFT.attach(nftDeployment.address);

		let { count } = taskArgs;

		count = parseInt(count, 10);
		if (!_.isNumber(count)) {
			throw new Error("Count of tokens to mint must be a number");
		}

		const [owner] = await ethers.getSigners();

		const value = 0.1 * count;
		console.log(`Minting to ${owner.address} for ${value} ETH...`);
		const tx = await nft.connect(owner).publicMint(count, {
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

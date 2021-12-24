task("make-permanent", "Make a specific NFT token metadata permanent")
	.addParam("id", "Token ID to make permanent")
	.setAction(async (taskArgs, { ethers, deployments }) => {
		const [owner] = ethers.getSigners();
		const nftDeployment = await deployments.get("NFT");
		const NFT = await ethers.getContractFactory("NFT");
		const nft = await NFT.attach(nftDeployment.address);

		// https://ethereum.stackexchange.com/questions/93757/listening-to-events-using-ethers-js-on-a-hardhat-test-network
		const tx = await nft.connect(owner).makePermanent(taskArgs.id);
		const receipt = await tx.wait();
		console.log(`Result Events:`);
		console.log(
			(receipt.events || []).filter((x) => x.event === "PermanentURI")
		);
	});

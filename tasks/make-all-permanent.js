task("make-all-permanent", "Make all NFT tokens' metadata permanent").setAction(
	async (taskArgs, { ethers, deployments }) => {
		const [owner] = ethers.getSigners();
		const nftDeployment = await deployments.get("NFT");
		const NFT = await ethers.getContractFactory("NFT");
		const nft = await NFT.attach(nftDeployment.address);

		const tx = await nft.connect(owner.address).makeAllPermanent();
		const receipt = await tx.wait();
		console.log(`Result Events:`);
		console.log(
			(receipt.events || []).filter((x) => x.event === "PermanentURI")
		);
	}
);

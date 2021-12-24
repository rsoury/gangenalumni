task("contract-uri", "Fetch the current Contact URI").setAction(
	async (taskArgs, { ethers, deployments }) => {
		const nftDeployment = await deployments.get("NFT");
		const NFT = await ethers.getContractFactory("NFT");
		const nft = await NFT.attach(nftDeployment.address);
		const contractURI = await nft.contractURI();
		console.log(`Contract URI: `, contractURI);
	}
);

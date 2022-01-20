// Return token URI for token

task("token-uri", "Fetch the current Token URI for a Token")
	.addParam("id", "Token Id")
	.setAction(async (taskArgs, { ethers, deployments }) => {
		const nftDeployment = await deployments.get("NFT");
		const NFT = await ethers.getContractFactory("NFT");
		const nft = await NFT.attach(nftDeployment.address);

		const { id } = taskArgs;

		const uri = await nft.uri(id);
		console.log(`Token URI: `, uri);
	});

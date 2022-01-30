// Script to set blacklisted token ids

task(
	"default-public-mint-uri",
	"Set the default Custom URI for all future Publicly Minted Tokens"
)
	.addParam("uri", "ERC1155 compatible metadata Token URI")
	.setAction(async (taskArgs, { ethers, deployments }) => {
		const npmDeployment = await deployments.get("NFTPublicMinter");
		const NFTPublicMinter = await ethers.getContractFactory("NFTPublicMinter");
		const npm = await NFTPublicMinter.attach(npmDeployment.address);

		const { uri } = taskArgs;

		if (uri.indexOf("{id}") < 0) {
			throw new Error("URI must be valid and compatible with ERC1155");
		}

		const [owner] = await ethers.getSigners();

		console.log(
			`Setting new Default Custom URI for Publicly Minted Tokens to ${uri}...`
		);
		const tx = await npm.connect(owner).setDefaultPublicMintCustomURI(uri);
		console.log(`Transaction created: ${tx.hash}`);
		await tx.wait();
		console.log(`Transaction successful!`);
	});

// deploy/00_deploy_NFT.js
module.exports = async ({ getNamedAccounts, deployments, network }) => {
	const { deploy, log } = deployments;
	const { deployer } = await getNamedAccounts();
	// OpenSea proxy registry addresses for rinkeby and mainnet.
	let proxyRegistryAddress = "";
	let contractURI = "";
	let tokenURI = "";
	if (network.live) {
		if (network.name === "rinkeby") {
			proxyRegistryAddress = "0xf57b2c51ded3a29e6891aba85459d600256cf317";
		} else {
			proxyRegistryAddress = "0xa5409ec958c83c3f309868babaca7c86dcb077c1";
		}
	} else {
		proxyRegistryAddress = await deployments.get("MockProxyRegistry");
	}
	if (network.name === "mainnet") {
		tokenURI =
			"https://gangenalumni.s3.us-east-2.amazonaws.com/mainnet/data/{id}.json";
		contractURI =
			"https://gangenalumni.s3.us-east-2.amazonaws.com/mainnet/data/contract.json";
	} else {
		tokenURI =
			"https://gangenalumni.s3.us-east-2.amazonaws.com/rinkeby/data/{id}.json";
		contractURI =
			"https://gangenalumni.s3.us-east-2.amazonaws.com/rinkeby/data/contract.json";
	}

	const nftDeployResult = await deploy("NFT", {
		from: deployer,
		args: [
			proxyRegistryAddress,
			"Gangen Alumni",
			"GANGA",
			contractURI,
			tokenURI
		],
		log: true
	});

	if (nftDeployResult.newlyDeployed) {
		log(
			`contract NFT deployed at ${nftDeployResult.contract.address} using ${nftDeployResult.receipt.gasUsed} gas`
		);
	}
};
module.exports.tags = ["NFT"];

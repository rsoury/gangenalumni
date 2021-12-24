// deploy/00_deploy_MockProxyRegistry.js
module.exports = async ({ getNamedAccounts, deployments, network }) => {
	const { deploy, log } = deployments;
	const { deployer } = await getNamedAccounts();
	console.log(deployer);
	if (!network.live) {
		// Deploy MockProxyRegistry to local node
		const mockProxyDeployResult = await deploy("MockProxyRegistry", {
			from: deployer,
			args: [],
			log: true
		});
		if (mockProxyDeployResult.newlyDeployed) {
			log(
				`contract MockProxyRegistry deployed at ${mockProxyDeployResult.address} using ${mockProxyDeployResult.receipt.gasUsed} gas`
			);
		}
	}
};
module.exports.tags = ["MockProxyRegistry"];

task("balance", "Get ETH balance in NFT Smart Contract").setAction(
	async (taskArgs, { deployments, waffle }) => {
		const nftDeployment = await deployments.get("NFT");

		console.log(`Fetching balance...`);
		const { provider } = waffle;
		const balance = await provider.getBalance(nftDeployment.address);
		console.log(
			`Balance of ${nftDeployment.address}: ${balance.toNumber()} ETH`
		);
	}
);

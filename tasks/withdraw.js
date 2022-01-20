// Script to withdraw funds from SC

task("withdraw", "Withdraw balance from NFT Smart Contract")
	.addOptionalParam("to", "Address to send withdrawn funds")
	.setAction(async (taskArgs, { ethers, deployments, waffle }) => {
		const nftDeployment = await deployments.get("NFT");
		const NFT = await ethers.getContractFactory("NFT");
		const nft = await NFT.attach(nftDeployment.address);

		let { to } = taskArgs;

		const [owner] = await ethers.getSigners();

		if (!to) {
			to = owner.address;
		}

		const { provider } = waffle;
		const balance = await provider.getBalance(nftDeployment.address);

		console.log(
			`Withdrawing balance of ${ethers.utils.formatEther(
				balance
			)} ETH to ${to}...`
		);
		const tx = await nft.connect(owner).withdraw(to);
		console.log(`Transaction created: ${tx.hash}`);
		await tx.wait();
		console.log(`Withdrawal successful!`);
	});

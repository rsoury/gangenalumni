// Script to withdraw funds from SC

task("withdraw", "Withdraw balance from NFT Smart Contract")
	.addOptionalParam("to", "Address to send withdrawn funds")
	.setAction(async (taskArgs, { ethers, deployments, waffle }) => {
		const npmDeployment = await deployments.get("NFTPublicMinter");
		const NFTPublicMinter = await ethers.getContractFactory("NFTPublicMinter");
		const npm = await NFTPublicMinter.attach(npmDeployment.address);

		let { to } = taskArgs;

		const [owner] = await ethers.getSigners();

		if (!to) {
			to = owner.address;
		}

		const { provider } = waffle;
		const balance = await provider.getBalance(npmDeployment.address);

		console.log(
			`Withdrawing balance of ${ethers.utils.formatEther(
				balance
			)} ETH to ${to}...`
		);
		const tx = await npm.connect(owner).withdraw(to);
		console.log(`Transaction created: ${tx.hash}`);
		await tx.wait();
		console.log(`Withdrawal successful!`);
	});

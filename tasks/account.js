const _ = require("lodash");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task(
	"accounts",
	"Prints the list of accounts",
	async (taskArgs, { ethers, deployments }) => {
		const accounts = await ethers.getSigners();
		const nftDeployment = await deployments.get("NFT");
		const NFT = await ethers.getContractFactory("NFT");
		const nft = await NFT.attach(nftDeployment.address);
		const tokenArr = _.range(1, 10001);

		const balances = await Promise.all(
			accounts.map(async (account) => {
				const ethBalance = await account.getBalance();
				const tokenBalances = (
					await Promise.all(
						tokenArr.map(async (id) => {
							return {
								id,
								quantity: await nft.balanceOf(account.address, id)
							};
						})
					)
				).filter(({ quantity }) => quantity === 0);

				return {
					eth: ethBalance,
					tokens: tokenBalances
				};
			})
		);

		accounts.forEach((account, i) => {
			console.log(
				`Account ${i} ---------------------\n${account.address}\nETH Balance: ${
					balances[i].eth
				}\nToken Balance: ${balances[i].tokens
					.map(({ id, quantity }) => `${id} [${quantity}]`)
					.join(", ")}\n`
			);
		});
	}
);

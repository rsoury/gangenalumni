// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task(
	"accounts",
	"Prints the list of accounts",
	async (taskArgs, { ethers }) => {
		const accounts = await ethers.getSigners();

		const balances = await Promise.all(
			accounts.map((account) => {
				return account.getBalance();
			})
		);
		accounts.forEach((account, i) => {
			console.log(
				`Account ${i} ---------------------\n${account.address}\nBalance: ${balances[i]}\n`
			);
		});
	}
);

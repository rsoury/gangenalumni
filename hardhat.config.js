require("dotenv").config();
require("@nomiclabs/hardhat-waffle");

const { INFURA_API_KEY = "", OWNER_PRIVATE_KEY = "" } = process.env;

if (!INFURA_API_KEY) {
	console.log("ERROR: INFURA_API_KEY is missing");
	process.exit(1);
}
if (!OWNER_PRIVATE_KEY) {
	console.log("ERROR: OWNER_PRIVATE_KEY is missing");
	process.exit(1);
}

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
	const accounts = await hre.ethers.getSigners();

	accounts.forEach((account) => {
		console.log(account.address);
	});
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
	solidity: "0.8.4",
	default: "hardhat",
	networks: {
		ropsten: {
			url: `https://ropsten.infura.io/v3/${INFURA_API_KEY}`,
			accounts: [OWNER_PRIVATE_KEY]
		},
		coverage: {
			url: "http://127.0.0.1:8555"
		}
	}
};

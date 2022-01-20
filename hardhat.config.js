require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-contract-sizer");
require("hardhat-deploy");

require("./tasks");

const { config: dotenvConfig } = require("dotenv");
const path = require("path");

dotenvConfig({ path: path.resolve(__dirname, "./.env") });

const {
	ALCHEMY_API_KEY = "",
	OWNER_PRIVATE_KEY = "",
	ETHERSCAN_API_KEY = "",
	// MNEMONIC = "",
	REPORT_GAS = false
} = process.env;

const chainIds = {
	goerli: 5,
	hardhat: 31337,
	kovan: 42,
	mainnet: 1,
	rinkeby: 4,
	ropsten: 3
};

if (!ALCHEMY_API_KEY) {
	console.log("ERROR: ALCHEMY_API_KEY is missing");
	process.exit(1);
}
if (!OWNER_PRIVATE_KEY) {
	console.log("ERROR: OWNER_PRIVATE_KEY is missing");
	process.exit(1);
}
if (!ETHERSCAN_API_KEY) {
	console.log("ERROR: ETHERSCAN_API_KEY is missing");
	process.exit(1);
}

module.exports = {
	defaultNetwork: "hardhat",
	gasReporter: {
		currency: "USD",
		enabled: !!REPORT_GAS,
		excludeContracts: [],
		src: "./contracts"
	},
	networks: {
		hardhat: {
			networkId: chainIds.hardhart
		},
		rinkeby: {
			url: `https://eth-rinkeby.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
			accounts: [OWNER_PRIVATE_KEY]
			// chainId: chainIds.rinkeby
		},
		mainnet: {
			url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
			accounts: [OWNER_PRIVATE_KEY]
		}
		// coverage: {
		// 	url: "http://127.0.0.1:8555"
		// }
	},
	paths: {
		artifacts: "./artifacts",
		cache: "./cache",
		sources: "./contracts",
		tests: "./test"
	},
	solidity: {
		version: "0.8.4"
	},
	etherscan: {
		apiKey: ETHERSCAN_API_KEY
	},
	contractSizer: {
		alphaSort: false,
		disambiguatePaths: false,
		runOnCompile: false, // Run using `npx hardhat size-contracts`
		strict: true
	},
	namedAccounts: {
		deployer: {
			default: 0 // Indicates that on all networks, the first wallet is the Owner of the Smart Contract.
		}
	}
};

// Script to set blacklisted token ids

const { types } = require("hardhat/config");
const _ = require("lodash");
const jsonfile = require("jsonfile");
const path = require("path");

task("blacklist", "Blacklist Token IDs from being minted publicly")
	.addOptionalParam("ids", "Comma-separated Token IDs to blacklist")
	.addOptionalParam(
		"file",
		"Path to JSON file with an array of Token IDs to blacklist."
	)
	.addOptionalParam(
		"clear",
		"Clear all blacklisted Token IDs",
		false,
		types.boolean
	)
	.setAction(async (taskArgs, { ethers, deployments }) => {
		const npmDeployment = await deployments.get("NFTPublicMinter");
		const NFTPublicMinter = await ethers.getContractFactory("NFTPublicMinter");
		const npm = await NFTPublicMinter.attach(npmDeployment.address);

		const { ids, file, clear } = taskArgs;

		const shouldClear = clear === true;

		let tokenIds = [];
		if (!shouldClear) {
			if (!_.isEmpty(file)) {
				const pathToFile = path.join(process.cwd(), file);
				tokenIds = await jsonfile.readFile(pathToFile);
			} else if (!_.isEmpty(ids)) {
				tokenIds = ids
					.split(",")
					.map((id) => parseInt(id.trim(), 10))
					.filter((id) => {
						if (Number.isNaN(id)) {
							console.log(`Token ${id} dismissed...`);
							return false;
						}
						if (!id) {
							return false;
						}
						return true;
					});
			}

			if (_.isEmpty(tokenIds)) {
				throw new Error("Ids or File parameter must be passed to this task.");
			}

			console.log(`Blacklisting ${tokenIds.length} token ids ...`);
		} else {
			console.log(`Clearing all blacklisted token ids ...`);
		}

		const [owner] = await ethers.getSigners();
		const tx = await npm.connect(owner).setBlacklistedTokenIds(tokenIds);
		console.log(`Transaction created: ${tx.hash}`);
		await tx.wait();
		console.log(`Transaction successful!`);

		if (tokenIds.length > 0) {
			const blacklistedArr = await Promise.all(
				tokenIds.map(async (id) => {
					return [id, await npm.isBlacklisted(id)];
				})
			);

			blacklistedArr.forEach(([id, isBlacklisted]) => {
				console.log(
					`Token Id ${id} ${isBlacklisted ? "is" : "is NOT"} blacklisted.`
				);
			});
		}
	});

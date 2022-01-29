task("batch-mint", "Batch mint NFT tokens to addresses")
	.addOptionalParam(
		"file",
		"Path to CSV File indicating which TokenIDs to are to created for each recipient Address. Either provide a file or input."
	)
	.addOptionalParam(
		"input",
		`
      Input for the batch creation Smart Contract function.
      Input is formatted like so:
        --input "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266:1,5,49,102|0x70997970C51812dc3A010C7d01b50e0d17dc79C8:2,6,50,105"

      Either provide a file or input.
    `
	)
	.addOptionalParam(
		"customUri",
		`The Custom URI to use for this given batch of NFTs`
	)
	.setAction(async (taskArgs, { ethers, deployments }) => {
		const nftDeployment = await deployments.get("NFT");
		const NFT = await ethers.getContractFactory("NFT");
		const nft = await NFT.attach(nftDeployment.address);

		const { file, input, customUri = "" } = taskArgs;

		const recipients = [];
		if (file) {
			// TODO: Parse the CSV file into the Recipients Array.
		} else if (input) {
			// Parse the Input into the Recipients Array
			const perAddress = input.split("|");
			perAddress.forEach((s) => {
				const [address, commaSeparatedIds] = s.split(":");
				const ids = commaSeparatedIds.split(",");
				const cleanIds = ids.filter((id) => !!id).map((id) => parseInt(id, 10)); // ensure that all ids can be numbers and are valid
				cleanIds.forEach((id) => {
					if (Number.isNaN(id)) {
						throw new Error(`Error for Address: ${address}. Token is invalid.`);
					}
				});
				const recipient = { address, ids: cleanIds };
				recipients.push(recipient);
			});
		}

		const [owner] = await ethers.getSigners();
		const tx = await nft.connect(owner).batchMintToMany(
			recipients.map(({ address }) => address),
			recipients.map(({ ids }) => ids),
			customUri,
			[]
		);
		console.log(`Transaction created: ${tx.hash}\n`);
		await tx.wait();

		for (let i = 0; i < recipients.length; i += 1) {
			const recipient = recipients[i];
			console.log(recipient.address);
			const arr = [];
			for (let j = 0; j < recipient.ids.length; j += 1) {
				const balance = await nft.balanceOf(
					recipient.address,
					recipient.ids[j]
				);
				arr.push(`${recipient.ids[j]} [${balance}]`);
			}
			console.log(`Tokens: ${arr.join(", ")}\n`);
		}
	});

task("batch-create", "Batch create NFT tokens to addresses")
	.addOptionalParam(
		"file",
		"Path to CSV File indicating which TokenIDs to are to created for each recipient Address. Either provide a file or input."
	)
	.addOptionalParam(
		"input",
		`
      Input for the batch creation Smart Contract function.
      Input is formatted like so:
        --input=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266:1,5,49,102|0x70997970C51812dc3A010C7d01b50e0d17dc79C8:2,6,50,105

      Either provide a file or input.
    `
	)
	.setAction(async (taskArgs, { ethers, deployments }) => {
		const nftDeployment = await deployments.get("NFT");
		const NFT = await ethers.getContractFactory("NFT");
		const nft = await NFT.attach(nftDeployment.address);

		const { file, input } = taskArgs;

		const recipients = [];
		if (file) {
			// Parse the CSV file into the Recipients Array.
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

		const [owner] = ethers.getSigners();
		const tx = await nft.connect(owner.address).batchCreate(
			recipients.map(({ address }) => address),
			recipients.map(({ ids }) => ids)
		);
		await tx.await();

		recipients.forEach((recipient) => {
			console.log(
				`${recipient.address}\nTokens: ${recipient.ids.join(", ")}\n`
			);
		});
	});

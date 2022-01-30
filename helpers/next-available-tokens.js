const _ = require("lodash");

const nextAvailableTokens = async (nftContract, npmContract, count = 1) => {
	const batchTransferEvents = await nftContract.queryFilter(`TransferBatch`);
	const singleTransferEvents = await nftContract.queryFilter(`TransferSingle`);
	const rootAddress = _.padEnd("0x", 42, "0");
	const batchMintEvents = batchTransferEvents.filter(
		(event) => event.args.from === rootAddress
	);
	const singleMintEvents = singleTransferEvents.filter(
		(event) => event.args.from === rootAddress
	);
	const mintedIds = [
		...singleMintEvents.map((event) => event.args.id.toNumber()),
		...batchMintEvents.reduce((acc, event) => {
			event.args.ids.forEach((id) => {
				acc.push(id.toNumber());
			});
			return acc;
		}, [])
	];
	mintedIds.sort((a, b) => {
		return a - b;
	});
	// console.log({ mintedIds });
	const tokens = [];
	const maxTokenCount = (await npmContract.MAX_TOKEN_COUNT()).toNumber();
	// console.log(maxTokenCount);
	let nextTokenId =
		mintedIds.length > 0 ? mintedIds[mintedIds.length - 1] + 1 : 1;
	while (tokens.length < count || nextTokenId > maxTokenCount) {
		const isBlacklisted = await npmContract.isBlacklisted(nextTokenId);
		if (!isBlacklisted) {
			tokens.push(nextTokenId);
		}
		nextTokenId += 1;
	}
	// console.log({ idsToMint });

	return tokens;
};

module.exports = nextAvailableTokens;

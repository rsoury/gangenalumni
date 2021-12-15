/**
 * Data Step 2
 *
 * Use the Collected Data to produce NFT metadata
 * Data comes from Accessories, Enhancements, and Face Recognition
 *
 * Metadata Standards:
 * https://docs.opensea.io/docs/metadata-standards
 * https://github.com/ethereum/EIPs/blob/master/EIPS/eip-721.md
 * https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1155.md#erc-1155-metadata-uri-json-schema
 */

require("dotenv").config();
const path = require("path");
const fs = require("fs").promises;
const chalk = require("chalk");
const mkdirp = require("mkdirp");
const glob = require("glob-promise");
const debugLog = require("debug")("datasets");
const jsonfile = require("jsonfile");
const _ = require("lodash");
const Queue = require("./utils/queue");
const options = require("./utils/options")((program) => {
	program.requiredOption(
		"-o, --output <value>",
		"Path to the output dataset directory."
	);
	program.option("-f, --face-data <value>", "Path to face dataset.");
	program.option("-e, --ethnicity-data <value>", "Path to ethnicity dataset.");
	program.option("-n, --name-data <value>", "Path to produced names dataset.");
	program.option(
		"-af, --accessories-file <value>",
		"Path to accessories output JSON file"
	);
	program.option(
		"-ef, --enhancements-file <value>",
		"Path to enhancements output JSON file"
	);
	program.option(
		"--overwrite",
		"Determine whether to overwrite the existing dataset files, or leave off the command to simply fill the missing files."
	);
});
const { inspectObject } = require("./utils");

const {
	input,
	faceData: faceDataInput,
	ethnicityData: ethnicityDataInput,
	namesData: namesDataInput,
	accessoriesFile,
	enhancementsFile,
	output: outputDir,
	overwrite
} = options;

const contractMetadata = {
	name: "Automatically Animated",
	description:
		"OpenSea Creatures are adorable aquatic beings primarily for demonstrating what can be done using the OpenSea platform. Adopt one today to try out all the OpenSea buying, selling, and bidding feature set.",
	image: "https://automaticallyanimated.com/image.png",
	external_link: "https://automaticallyanimated.com",
	seller_fee_basis_points: 250, // Indicates a 2.5% seller fee.
	fee_recipient: "0x8D674B63BB0F59fEebc08565AbcB7fdfe3801817" // Where seller fees will be paid to.
};

// Unique Id for Folder to store files in...
// const currentTs = Date.now();

debugLog(`Output Directory: ${outputDir}`);

// Create dir
mkdirp.sync(outputDir);

(async () => {
	const images = await glob(`${input}/*.{jpeg,jpg,png}`, {
		absolute: true
	});
	const faceDataSources = await glob(`${faceDataInput}/*.json`, {
		absolute: true
	});
	const ethnDataSources = await glob(`${ethnicityDataInput}/*.json`, {
		absolute: true
	});
	const namesDataSources = await glob(`${namesDataInput}/*.json`, {
		absolute: true
	});
	const accessoriesDataSource = path.absolute(accessoriesFile);
	const enhancementsDataSource = path.absolute(enhancementsFile);
	const accessoriesData = await jsonfile.readFile(accessoriesDataSource);
	const enhancementsData = await jsonfile.readFile(enhancementsDataSource);

	const getNameFromPath = (filepath) =>
		path.basename(filepath).split(".").slice(0, -1).join(".");
	const sources = faceDataSources.map((filepath) => {
		const fdName = getNameFromPath(filepath);
		const findFn = (fp) => {
			const edName = getNameFromPath(fp);
			return fdName === edName;
		};
		const ethnFilepath = ethnDataSources.find(findFn);
		const namesFilepath = namesDataSources.find(findFn);

		return {
			id: fdName,
			face: filepath,
			ethnicity: ethnFilepath,
			name: namesFilepath,
			image: images.find(findFn)
		};
	});

	const q = new Queue(
		async ({ files }) => {
			const { id } = files;
			const accessories = accessoriesData.accessoriesAdded[id];
			const enhancements = _.get(
				enhancementsData.find(({ id: dataId }) => id === dataId),
				"enhancements",
				[]
			);
			const outputFile = path.join(outputDir, `${id}.json`);
			if (!overwrite) {
				try {
					await fs.access(outputFile, fs.F_OK); // try access the file to determine if it exists.
					return { file, output: outputFile, skipped: true }; // return if successful access
				} catch (e) {
					// ...
				}
			}

			const faceData = await jsonfile.readFile(files.face);
			const ethnicityData = await jsonfile.readFile(files.ethnicity);
			const nameData = await jsonfile.readFile(files.name);

			const { name } = nameData;
			// We're going to need to conditionally deploy the images to Pinata/IPFS or S3 -- to construct the images
			const image = `https://example.com/${id}.png`;
			const attributes = [];

			const result = {
				name,
				description: ``, // Markdown supported
				external_url: contractMetadata.external_link,
				image,
				attributes
			};

			await jsonfile.writeFile(outputFile, result);

			return { files, output: outputFile };
		},
		{
			batchDelay: 200,
			concurrent: 5,
			maxRetries: 3,
			retryDelay: 1000
		}
	);

	// Queue the images for filtering.
	console.log(chalk.yellow(`Processing dataset to produce NFT metadata...`));
	sources.forEach((files, i) => {
		q.push({ files, i });
	});

	q.on("task_failed", (taskId, err) => {
		console.log(chalk.red(`[${taskId}] Could not process file`));
		console.error(inspectObject(err));
	});

	q.on("task_finish", (taskId, result) => {
		console.log(
			chalk.green(`[${taskId}] Successfully produced metadata`),
			result
		);
	});

	await new Promise((resolve) => {
		q.on("drain", () => {
			resolve();
		});
	});

	console.log(chalk.green(`All done!`));
})();

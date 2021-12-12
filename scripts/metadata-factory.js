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
const Queue = require("./utils/queue");
const options = require("./utils/options")((program) => {
	program.requiredOption(
		"-o, --output <value>",
		"Path to the output dataset directory."
	);
	program.option(
		"--accessories <value>",
		"Path to accessories output JSON file"
	);
	program.option(
		"--enhancements <value>",
		"Path to enhancements output JSON file"
	);
	program.option(
		"--overwrite",
		"Determine whether to overwrite the existing dataset files, or leave off the command to simply fill the missing files."
	);
});
const { inspectObject } = require("./utils");

const {
	input, // Pass Face Recognition Data Set to this parameter
	accessories: accessoriesInput,
	enhancements: enhancementsInput,
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

let dataset = [];

// Create dir
mkdirp.sync(outputDir);

(async () => {
	const stat = await fs.lstat(input);
	if (stat.isFile()) {
		// Use file as image
		dataset.push(path.resolve(input));
	} else {
		// Get images from directory
		dataset = await glob(`${input}/*.json`, {
			absolute: true
		});
	}

	const accessoriesData = await jsonfile.readFile(accessoriesInput);
	const enhancementsData = await jsonfile.readFile(enhancementsInput);

	const q = new Queue(
		async ({ file }) => {
			const id = path.basename(file).split(".").slice(0, -1).join(".");
			const outputFile = path.join(outputDir, `${id}.json`);
			if (!overwrite) {
				try {
					await fs.access(outputFile, fs.F_OK); // try access the file to determine if it exists.
					return { file, output: outputFile, skipped: true }; // return if successful access
				} catch (e) {
					// ...
				}
			}

			const name = "";

			const result = {
				name,
				description: "",
				external_url: contractMetadata.external_link,
				image: `https://example.com/${id}.png`,
				attributes: []
			};

			await jsonfile.writeFile(outputFile, result);

			return { file, output: outputFile };
		},
		{
			batchDelay: 200,
			concurrent: 5
		}
	);

	// Queue the images for filtering.
	console.log(chalk.yellow(`Processing dataset to produce NFT metadata...`));
	dataset.forEach((file, i) => {
		q.push({ file, i });
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

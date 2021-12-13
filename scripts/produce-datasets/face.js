/**
 * Data Step 1 -- After Step 1 of generating Avatars.
 *
 * Collect AI based data on each of the images in Step 1.
 */

require("dotenv").config();
const path = require("path");
const { Rekognition } = require("aws-sdk");
const fs = require("fs").promises;
const chalk = require("chalk");
const mkdirp = require("mkdirp");
const glob = require("glob-promise");
const debugLog = require("debug")("datasets");
const jsonfile = require("jsonfile");
const Queue = require("../utils/queue");
const options = require("../utils/options")((program) => {
	program.requiredOption(
		"-o, --output <value>",
		"Path to the output dataset directory."
	);
	program.option(
		"--overwrite",
		"Determine whether to overwrite the existing dataset files, or leave off the command to simply fill the missing files."
	);
});
const { inspectObject } = require("../utils");

const { input, output: outputDir, overwrite } = options;

// Unique Id for Folder to store files in...
// const currentTs = Date.now();

debugLog(`Output Directory: ${outputDir}`);

let sourceImages = [];

// Create dir
mkdirp.sync(outputDir);

const rekognition = new Rekognition({
	region: process.env.AWS_REGION || "us-east-1"
});

(async () => {
	const stat = await fs.lstat(input);
	if (stat.isFile()) {
		// Use file as image
		sourceImages.push(path.resolve(input));
	} else {
		// Get images from directory
		sourceImages = await glob(`${input}/*.{jpeg,jpg,png}`, {
			absolute: true
		});
	}

	const q = new Queue(
		async ({ image }) => {
			const name = path.basename(image).split(".").slice(0, -1).join(".");
			const outputFile = path.join(outputDir, `${name}.json`);
			if (!overwrite) {
				try {
					await fs.access(outputFile, fs.F_OK); // try access the file to determine if it exists.
					return { image, output: outputFile, skipped: true }; // return if successful access
				} catch (e) {
					// ...
				}
			}

			const fileBuffer = await fs.readFile(image);
			const result = await rekognition
				.detectFaces({
					Image: { Bytes: fileBuffer },
					Attributes: ["ALL"]
				})
				.promise();

			await jsonfile.writeFile(outputFile, result);

			return { image, output: outputFile };
		},
		{
			batchDelay: 200,
			concurrent: 5
		}
	);

	// Queue the images for filtering.
	console.log(
		chalk.yellow(`Processing facial analysis using AWS Rekognition...`)
	);
	sourceImages.forEach((image, i) => {
		q.push({ image, i });
	});

	q.on("task_failed", (taskId, err) => {
		console.log(chalk.red(`[${taskId}] Could not process image`));
		console.error(inspectObject(err));
	});

	q.on("task_finish", (taskId, result) => {
		console.log(
			chalk.green(`[${taskId}] Successfully processed image`),
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

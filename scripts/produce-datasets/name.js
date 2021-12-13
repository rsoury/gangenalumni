/**
 * Data Step 3 -- After production of Face Dectection Datasets -- produce-datasets/face.js
 *
 * Produce Character Names using Ethnicity Predictions for each of the images in Step 1.
 * Uses OpenAI Character Prediction
 */

require("dotenv").config();
const path = require("path");
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

let sources = [];

// Create dir
mkdirp.sync(outputDir);

(async () => {
	const stat = await fs.lstat(input);
	if (stat.isFile()) {
		// Use file as image
		sources.push(path.resolve(input));
	} else {
		// Get images from directory
		sources = await glob(`${input}/*.json`, {
			absolute: true
		});
	}

	const q = new Queue(
		async ({ file }) => {
			const name = path.basename(file).split(".").slice(0, -1).join(".");
			const outputFile = path.join(outputDir, `${name}.json`);
			if (!overwrite) {
				try {
					await fs.access(outputFile, fs.F_OK); // try access the file to determine if it exists.
					return { file, output: outputFile, skipped: true }; // return if successful access
				} catch (e) {
					// ...
				}
			}

			const result = {};

			await jsonfile.writeFile(outputFile, result);

			return { file, output: outputFile };
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
	sources.forEach((file, i) => {
		q.push({ file, i });
	});

	q.on("task_failed", (taskId, err) => {
		console.log(chalk.red(`[${taskId}] Could not process image`));
		console.error(inspectObject(err));
	});

	q.on("task_finish", (taskId, result) => {
		console.log(chalk.green(`[${taskId}] Successfully painted image`), result);
	});

	await new Promise((resolve) => {
		q.on("drain", () => {
			resolve();
		});
	});

	console.log(chalk.green(`All done!`));
})();

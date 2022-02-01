/**
 * Script to split an avatar directory by a specific data point
 */

require("dotenv").config();
const path = require("path");
const chalk = require("chalk");
const mkdirp = require("mkdirp");
const jsonfile = require("jsonfile");
const Queue = require("../utils/queue");
const options = require("../utils/options")((program) => {
	program.option(
		"-o, --output <value>",
		"An optional path to an output directory. By default the input path is used as the basis for the output path."
	);
	program.requiredOption(
		"-f, --facedata <value>",
		"Path to the facedata dataset directory."
	);
	program.requiredOption(
		"-b, --by <value>",
		"Flag to exclude images by. ie. beards"
	);
});
const {
	inspectObject,
	stripTrailingSlash,
	getImages,
	copy
} = require("../utils");

const { input, facedata: faceDatasetDir, by } = options;
const outputDir = stripTrailingSlash(options.output || input);

// Create dir
const outputDirBy = path.join(`${outputDir}-split`, by);
const outputDirBase = `${outputDir}-split/base`;
mkdirp.sync(outputDirBy);
mkdirp.sync(outputDirBase);

(async () => {
	const sourceImages = await getImages(input);

	const q = new Queue(
		async ({ image }) => {
			const name = path.basename(image).split(".").slice(0, -1).join(".");
			const faceFile = path.join(faceDatasetDir, `${name}.json`);
			const faceData = await jsonfile.readFile(faceFile);
			const faceDetails = faceData.FaceDetails[0];
			let outputFile = path.join(outputDirBase, path.basename(image));
			if (by === "beards") {
				if (faceDetails.Beard.Value || faceDetails.Mustache.Value) {
					outputFile = path.join(outputDirBy, path.basename(image));
				}
			}

			await copy(image, outputFile);

			return image;
		},
		{
			batchDelay: 200,
			concurrent: 5
		}
	);

	// Queue the images for filtering.
	sourceImages.forEach((image, i) => {
		q.push({ image, i });
	});

	q.on("task_failed", (taskId, err) => {
		console.log(chalk.red(`[${taskId}] Could not process image`));
		console.error(inspectObject(err));
	});

	q.on("task_finish", (taskId, result) => {
		console.log(`Successfully processed image ${result}`);
	});

	await new Promise((resolve) => {
		q.on("drain", () => {
			resolve();
		});
	});

	console.log(chalk.green(`All done!`));
})();

/**
 * Data Step 2 -- After production of Face Dectection Datasets -- produce-datasets/face.js
 * Produce Label/Object Dataset -- which lists different objects within an image with confidence metric.
 * This will have to also produce a list of labels aggregated from each result for us to use inside of metadata-factory.js
 */

require("dotenv").config();
const path = require("path");
const fs = require("fs").promises;
const chalk = require("chalk");
const mkdirp = require("mkdirp");
const debugLog = require("debug")("datasets");
const jsonfile = require("jsonfile");
const _ = require("lodash");
const vision = require("@google-cloud/vision").v1;
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
const { getImages, getName } = require("../utils");

const { GOOGLE_CLOUD_KEY_FILE } = process.env;

if (!GOOGLE_CLOUD_KEY_FILE) {
	throw new Error("Google Cloud API Key is required to execute this Script");
}

const { input, output: outputDir, overwrite } = options;

debugLog(`Output Directory: ${outputDir}`);

// Create dir
mkdirp.sync(outputDir);

// Creates a client
const client = new vision.ImageAnnotatorClient({
	keyFilename: path.join(__dirname, "../../", GOOGLE_CLOUD_KEY_FILE)
});

(async () => {
	const sourceImages = await getImages(input);

	const q = new Queue(
		async ({ image }) => {
			const name = getName(image);
			const outputFile = path.join(outputDir, `${name}.json`);
			if (!overwrite) {
				try {
					await fs.access(outputFile, fs.F_OK); // try access the file to determine if it exists.
					return { image, output: outputFile, skipped: true }; // return if successful access
				} catch (e) {
					// ...
				}
			}

			const [
				{ localizedObjectAnnotations: objects, labelAnnotations: labels } = {}
			] = await client.annotateImage({
				image: {
					source: {
						filename: image
					}
				},
				features: [
					{ type: "LABEL_DETECTION", maxResults: 99 },
					{ type: "OBJECT_LOCALIZATION", maxResults: 20 }
				]
			});
			const response = { objects, labels };
			// console.log(inspectObject(response));

			await jsonfile.writeFile(outputFile, response);

			return { image, output: outputFile };
		},
		{
			batchDelay: 200,
			concurrent: 5
		}
	);

	// Queue the images for filtering.
	console.log(
		chalk.yellow(`Processing label/object analysis of input images...`)
	);
	sourceImages.forEach((image, i) => {
		q.push({ image, i });
	});

	q.on("task_failed", (taskId, err) => {
		console.log(chalk.red(`[${taskId}] Could not process image`));
		console.error("Received failed status: ", err.message);
	});

	q.on("task_finish", async (taskId, result) => {
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

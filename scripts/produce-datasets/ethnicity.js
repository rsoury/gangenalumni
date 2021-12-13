/**
 * Data Step 2 -- After production of Face Dectection Datasets -- produce-datasets/face.js
 *
 * Collect AI based Ethnicity Prediction data on each of the images in Step 1.
 * Uses the Clarifai Demographics AI Model
 */

require("dotenv").config();
const path = require("path");
const fs = require("fs").promises;
const chalk = require("chalk");
const mkdirp = require("mkdirp");
const glob = require("glob-promise");
const debugLog = require("debug")("datasets");
const jsonfile = require("jsonfile");
const { ClarifaiStub, grpc } = require("clarifai-nodejs-grpc");
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

const stub = ClarifaiStub.grpc();
const metadata = new grpc.Metadata();
metadata.set("authorization", "Key 014022e6a9d54677acfe9731114ee1e3");

debugLog(`Output Directory: ${outputDir}`);

let sourceImages = [];

// Create dir
mkdirp.sync(outputDir);

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
			const fileBase64 = Buffer.from(fileBuffer).toString("base64");
			const result = await new Promise((resolve, reject) => {
				stub.PostModelOutputs(
					{
						// This is the model ID of a publicly available General model. You may use any other public or custom model ID.
						model_id: "93c277ec3940fba661491fda4d3ccfa0", // appearance-multicultural -- pre-trained model
						inputs: [
							{
								data: {
									image: { base64: fileBase64 }
								}
							}
						]
					},
					metadata,
					(err, response) => {
						if (err) {
							return reject(err);
						}

						if (response.status.code !== 10000) {
							debugLog(
								"Received failed status: " +
									response.status.description +
									"\n" +
									response.status.details
							);
							return reject(new Error(response.status.description));
						}

						debugLog("Predicted concepts, with confidence values:");
						response.outputs[0].data.concepts.forEach((c) => {
							debugLog(c.name + ": " + c.value);
						});
						return resolve(response.outputs[0]);
					}
				);
			});

			await jsonfile.writeFile(outputFile, result.data.concepts);

			return { image, output: outputFile };
		},
		{
			batchDelay: 200,
			concurrent: 5
		}
	);

	// Queue the images for filtering.
	console.log(chalk.yellow(`Processing ethnicity analysis of input images...`));
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

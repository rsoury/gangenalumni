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
const options = require("./utils/options")((program) => {
	program.requiredOption(
		"-o, --output <value>",
		"Path to the output dataset directory."
	);
});
const { input, output: outputDir } = options;

debugLog(`Output Directory: ${outputDir}`);

// Create dir
mkdirp.sync(outputDir);

(async () => {
	const outputFile = path.join(outputDir, `merged.json`);
	const sources = await glob(`${input}/*.json`, {
		absolute: true
	});

	const jsondata = [];

	console.log(chalk.green(`All done!`));
})();

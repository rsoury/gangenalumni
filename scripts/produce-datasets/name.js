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
const axios = require("axios");
const axiosRetry = require("axios-retry");
const human = require("humanparser");
const _ = require("lodash");

const Queue = require("../utils/queue");
const options = require("../utils/options")((program) => {
	program.option("-e, --ethnicity-data <value>", "Path to ethnicity dataset.");
	program.option("-f, --face-data <value>", "Path to face dataset.");
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

const { OPENAI_API_KEY } = process.env;

if (!OPENAI_API_KEY) {
	throw new Error("OpenAI API Key is required to execute this Script");
}

const request = axios.create({
	baseURL: "https://api.openai.com/v1",
	timeout: 30000,
	headers: {
		"Content-Type": "application/json",
		Authorization: `Bearer ${OPENAI_API_KEY}`
	}
});

axiosRetry(request, {
	retries: 3
});

const {
	faceData: faceDataInput,
	ethnicityData: ethnicityDataInput,
	output: outputDir,
	overwrite
} = options;

// Unique Id for Folder to store files in...
// const currentTs = Date.now();

debugLog(`Output Directory: ${outputDir}`);

let sources = [];

// Create dir
mkdirp.sync(outputDir);

(async () => {
	// Get images from directory
	const faceDataSources = await glob(`${faceDataInput}/*.json`, {
		absolute: true
	});
	const ethnDataSources = await glob(`${ethnicityDataInput}/*.json`, {
		absolute: true
	});

	sources = faceDataSources.map((filepath) => {
		const fdName = path.basename(filepath).split(".").slice(0, -1).join(".");
		const ethnFilepath = ethnDataSources.find((fp) => {
			const edName = path.basename(fp).split(".").slice(0, -1).join(".");
			return fdName === edName;
		});

		return {
			name: fdName,
			face: filepath,
			ethnicity: ethnFilepath
		};
	});

	const q = new Queue(
		async ({ files }) => {
			const outputFile = path.join(outputDir, `${files.name}.json`);
			if (!overwrite) {
				try {
					await fs.access(outputFile, fs.F_OK); // try access the file to determine if it exists.
					return { file: files.face, output: outputFile, skipped: true }; // return if successful access
				} catch (e) {
					// ...
				}
			}

			const ethnicityData = await jsonfile.readFile(files.ethnicity);
			const faceData = await jsonfile.readFile(files.face);
			const gender = _.get(faceData, "FaceDetails[0].Gender.Value", "");
			const ethnicity = ethnicityData
				.reduce((ethResult, currentValue) => {
					if (currentValue.value > 0.25) {
						ethResult.push(currentValue.name.replace("_", " "));
					}
					return ethResult;
				}, [])
				.join(" Or ");
			const seedWords = [ethnicity, gender].join(", ");
			const payload = {
				prompt: `This is a human person full name generator.\n\nSeed Words: White, Male\nPerson Full Name: Ryan M Loury \n\nSeed Words: East Asian, Female\nPerson Full Name: Kira Lee Xi\n\nSeed Words: Middle Eastern, Male\nPerson Full Name: Muhammad ibn Lahme bi Ajin\n\nSeed Words: White, Male\nPerson Full Name: Joseph Marconi\n\nSeed Words: ${seedWords}\nPerson Full Name:`,
				temperature: 0.75,
				max_tokens: 100,
				top_p: 1,
				frequency_penalty: 0,
				presence_penalty: 0,
				stop: ["\n"]
			};
			const response = await request
				.post("/engines/davinci/completions", payload)
				.then(({ data }) => data);
			if (response.choices.length === 0) {
				throw new Error("No choices returned by the OpenAPI request");
			}
			const personName = human.getFullestName(response.choices[0].text.trim());
			const result = {
				name: personName,
				parsed: human.parseName(personName),
				seedWords,
				response
			};
			if (_.isEmpty(result.name)) {
				throw new Error("No text returned by the OpenAPI request");
			}

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
	console.log(
		chalk.yellow(`Processing character data to produce human full names...`)
	);
	sources.forEach((files, i) => {
		q.push({ files, i });
	});

	q.on("task_failed", (taskId, err) => {
		console.log(chalk.red(`[${taskId}] Could not process image`));
		console.error(inspectObject(err));
	});

	q.on("task_finish", (taskId, result) => {
		console.log(chalk.green(`[${taskId}] Successfully produced name`), result);
	});

	await new Promise((resolve) => {
		q.on("drain", () => {
			resolve();
		});
	});

	console.log(chalk.green(`All done!`));
})();

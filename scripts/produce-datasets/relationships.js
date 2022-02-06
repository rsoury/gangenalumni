/**
 * Data Step 2 -- After production of Face Dectection Datasets -- produce-datasets/face.js
 * Produce Relationships Dataset -- which produces an array of Family Units comprised of Character Ids
 */

require("dotenv").config();
const path = require("path");
const fs = require("fs").promises;
const chalk = require("chalk");
const mkdirp = require("mkdirp");
const debugLog = require("debug")("datasets");
const jsonfile = require("jsonfile");
const _ = require("lodash");
const glob = require("glob-promise");
const { Rekognition } = require("aws-sdk");
const Queue = require("../utils/queue");
const options = require("../utils/options")((program) => {
	program.requiredOption(
		"-o, --output <value>",
		"Path to the output dataset directory."
	);
	program.requiredOption("-f, --face-data <value>", "Path to face dataset.");
	program.requiredOption(
		"-e, --ethnicity-data <value>",
		"Path to ethnicity dataset."
	);
	program.option(
		"--overwrite",
		"Determine whether to overwrite the existing dataset files, or leave off the command to simply fill the missing files."
	);
});
const { getImages, getName } = require("../utils");

const {
	input,
	faceData: faceDataInput,
	ethnicityData: ethnicityDataInput,
	output: outputDir,
	overwrite
} = options;

debugLog(`Output Directory: ${outputDir}`);

const comparisonsDir = path.join(outputDir, "comparisons");

// Create dir
mkdirp.sync(outputDir);
mkdirp.sync(comparisonsDir);

const rekognition = new Rekognition();

const compareFaces = async (sourceImgPath, targetImgPath) => {
	const sourceId = getName(sourceImgPath);
	const targetId = getName(targetImgPath);
	const comparison = (
		(await Promise.all(
			[
				[sourceId, targetId],
				[targetId, sourceId]
			].map(async (pair) => {
				const comparisonPath = path.join(
					comparisonsDir,
					`${pair[0]}-${pair[1]}.json`
				);
				const stat = await fs.lstat(comparisonPath);
				if (!stat.isFile()) {
					return false;
				}
				const result = await jsonfile.readFile(comparisonPath);
				return result;
			})
		)) || []
	).find((result) => !_.isEmpty(result));

	if (!_.isEmpty(comparison)) {
		return comparison;
	}

	const source = await fs.readFile(sourceImgPath);
	const target = await fs.readFile(targetImgPath);
	const response = await rekognition
		.compareFaces({
			SourceImage: {
				Bytes: Buffer.from(source).toString("base64")
			},
			TargetImage: {
				Bytes: Buffer.from(target).toString("base64")
			}
		})
		.promise();

	const result = {
		similarity: response.FaceMatches[0].Similarity,
		sourceId,
		targetId,
		response
	};

	// Cache the result
	await jsonfile.writeFile(
		path.join(comparisonsDir, `${sourceId}-${targetId}.json`),
		result
	);

	return result;
};

(async () => {
	const sourceImages = await getImages(input);
	const faceDataSources = await glob(`${faceDataInput}/*.json`, {
		absolute: true
	});
	const ethnDataSources = await glob(`${ethnicityDataInput}/*.json`, {
		absolute: true
	});

	const ages = {};
	for (let i = 0; i < faceDataSources.length; i += 1) {
		const faceFile = faceDataSources[i];
		const faceData = faceFile ? await jsonfile.readFile(faceFile) : {};
		const faceDetails = faceData.FaceDetails[0];
		// Determine Age
		let age =
			Math.floor(
				Math.random() * (faceDetails.AgeRange.High - faceDetails.AgeRange.Low)
			) +
			(faceDetails.AgeRange.Low === 0 && faceDetails.AgeRange.High <= 3
				? faceDetails.AgeRange.Low
				: 1);
		const name = getName(faceFile);
		if (!age) {
			age = "< 1";
		}
		ages[name] = age;
	}

	if (Object.keys(ages).length !== faceDataSources.length) {
		throw new Error("Face element has been skipped");
	} else {
		const noAged = Object.entries(ages)
			.filter(([, v]) => v === 0 || v === "0")
			.map(([k]) => k);
		if (noAged.length > 0) {
			console.log(chalk.red("No age for tokens"), noAged.length, noAged);
			throw new Error("Tokens without age");
		}
	}
	console.log(chalk.green(`Ages processed`));

	const q = new Queue(
		async ({ image }) => {
			const name = getName(image);
			const nameNum = parseInt(name, 10);
			const outputFile = path.join(outputDir, `${name}.json`);
			if (!overwrite) {
				try {
					await fs.access(outputFile, fs.F_OK); // try access the file to determine if it exists.
					return { image, output: outputFile, skipped: true }; // return if successful access
				} catch (e) {
					// ...
				}
			}
			const faceFile = faceDataSources.find(
				(filePath) => getName(filePath) === name
			);
			const ethnFile = ethnDataSources.find(
				(filePath) => getName(filePath) === name
			);
			const faceData = faceFile ? await jsonfile.readFile(faceFile) : {};
			const ethnData = ethnFile ? await jsonfile.readFile(ethnFile) : {};
			const faceDetails = faceData.FaceDetails[0];

			const result = {
				age: ages[nameNum]
			};

			return { image, output: outputFile };
		},
		{
			batchDelay: 200,
			concurrent: 5
		}
	);

	// Queue the images for filtering.
	console.log(
		chalk.yellow(`Processing relationships analysis of input images...`)
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

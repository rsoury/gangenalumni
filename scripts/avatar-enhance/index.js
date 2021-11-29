/**
 * Step 2.1 -- An optional step
 * Enhance the Human Avatars using FaceApp in BlueStacks
 *
 * Requires that Bluestacks 4 is open, and that Media Manager has imported all images.
 * Running enhance go script requires opencv4 as a dependency.
 */

const path = require("path");
const fs = require("fs").promises;
const chalk = require("chalk");
const mkdirp = require("mkdirp");
const glob = require("glob-promise");
const util = require("util");
const sharp = require("sharp");
const debugLog = require("debug")("avatar-enhance");
// const sizeOf = require("image-size");
const jsonfile = require("jsonfile");
const { exec } = require("child-process-promise");

const options = require("../options")();
const Queue = require("../queue");

const { input } = options;

sharp.cache(false);

// Unique Id for Folder to store files in...
const currentTs = Date.now();
const outputDir = path.resolve(__dirname, `../../output/step2.1/${currentTs}`);

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

	debugLog(sourceImages);

	const enhancementsAdded = {};

	const q = new Queue(
		async ({ image }) => {
			const outputFile = path.join(outputDir, path.basename(image));
			const filename = path.basename(image).replace(/\.[^/.]+$/, ""); // Regex to remove the extension.
			const awsFrFilepath = path.join(
				__dirname,
				`../../data/aws/${filename}.json`
			);
			const awsFrData = await jsonfile.readFile(awsFrFilepath);

			/**
			 * 1. Read the image data and then Use OpenCV to find the matching image in the FaceApp -- requires scroll behaviour through FaceApp.
			 * 2. Select the matching image.
			 * 3. Check if user has beard -- add beard. -- random selection of beard type depending on if mustache/beard
			 * 4. Check if user has glasses -- add glasses -- random selection
			 * 5. Check if female, and probability for make up -- add make up -- random selection
			 */

			return image;
		},
		{
			batchDelay: 1000
		}
	);

	// Queue the images for filtering.
	sourceImages.forEach((image, i) => {
		q.push({ image, i });
	});

	q.on("task_failed", (taskId, err) => {
		console.log(chalk.red(`[${taskId}] Could not process image`));
		console.error(util.inspect(err, false, null, true));
	});

	q.on("task_finish", (taskId, result) => {
		console.log(`Successfully processed image ${result}`);
	});

	await new Promise((resolve) => {
		q.on("drain", () => {
			resolve();
		});
	});

	await fs.writeFile(
		path.join(outputDir, "info.json"),
		JSON.stringify({
			script: "enhance",
			ts: currentTs,
			source: input,
			output: outputDir,
			count: sourceImages.length,
			enhancementsAdded
		})
	);

	console.log(chalk.green(`All done!`));
})();

/**
 * Script to rename enhanced exported images to their distance to the compared images where index.json resides.
 * Designed for Beard enhancements only.
 */

require("dotenv").config();
const path = require("path");
const chalk = require("chalk");
const mkdirp = require("mkdirp");
const sharp = require("sharp");
const Jimp = require("jimp");
const Queue = require("../utils/queue");
const options = require("../utils/options")((program) => {
	program.option(
		"-o, --output <value>",
		"An optional path to an output directory. By default the input path is used as the basis for the output path."
	);
	program.requiredOption(
		"-c, --compare <value>",
		"Path to directory of images that are compared with the input enhanged exported images. These images must be named with their correct ID."
	);
});
const {
	inspectObject,
	stripTrailingSlash,
	getImages,
	getName,
	copy
} = require("../utils");

console.log(chalk.yellow(`Starting beard detection ...`));

// The input directory of images is the Exported images.
// The compare directory of images is the original/imported/pre-enhanced images.
const { input, compare: compareDir } = options;
const outputDir = `${stripTrailingSlash(options.output || input)}-rename`;
mkdirp.sync(outputDir);

console.log(chalk.yellow(`Output directory created ...`));

(async () => {
	const sourceImages = await getImages(input);
	const compareImages = await getImages(compareDir);
	console.log(chalk.yellow(`Images and data obtained ...`));

	const q = new Queue(
		async ({ image }) => {
			const dim = [720, 720];
			const img = await sharp(image)
				.resize({ width: dim[0], height: dim[1] })
				.extract({ top: 0, left: 0, width: dim[0], height: dim[1] / 2 })
				.png()
				.toBuffer();
			const jImg = await Jimp.read(img);

			const match = {}; // distance, id -- to populate this object.
			for (let i = 0; i < compareImages.length; i += 1) {
				const imgPath = compareImages[i];
				const cmpImg = await sharp(imgPath)
					.resize({ width: dim[0], height: dim[1] })
					.extract({ top: 0, left: 0, width: dim[0], height: dim[1] / 2 })
					.png()
					.toBuffer();
				const id = getName(imgPath);
				const jCmpImg = await Jimp.read(cmpImg);
				const { percent: percentDiff } = Jimp.diff(jImg, jCmpImg);
				if (
					percentDiff < match.distance ||
					typeof match.distance === "undefined"
				) {
					match.distance = percentDiff;
					match.id = id;
				}
				console.log(
					chalk.grey(`[${image}] Compare with ${path.basename(imgPath)} ...`)
				);
			}

			if (match.id) {
				console.log(chalk.grey(`[${image}] Match found ${match.id} ...`));
			} else {
				console.log(chalk.red(`[${image}] Match not found ...`));
			}

			// Copy the image to the new directory with the new id as the name.
			const destination = path.join(
				outputDir,
				`${match.id}${path.extname(image)}`
			);
			await copy(image, destination);

			console.log(chalk.grey(`[${image}] Image written to ${destination}`));

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

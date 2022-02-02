/**
 * Script to produce the beard enhancement index.json based on image comparison and detect the ID for each exported images
 *
 * CMD:
 * node ./scripts/extras/beard-detect.js --input ./tmp/remote-output-step2.1/from-aws-filters-with-beards-enhanced --beards ./output/step2.1/1642724209-beards-2-rename --beards-index ./tmp/remote-output-step2.1/1642724209-beards-2/index.json --compare ./tmp/remote-output-step2.1/from-aws-filters-with-beards
 */

require("dotenv").config();
const path = require("path");
const chalk = require("chalk");
const mkdirp = require("mkdirp");
const jsonfile = require("jsonfile");
const sharp = require("sharp");
const sizeOf = require("image-size");
const imghash = require("imghash");
const Queue = require("../utils/queue");
const options = require("../utils/options")((program) => {
	program.option(
		"-o, --output <value>",
		"An optional path to an output directory. By default the input path is used as the basis for the output path."
	);
	program.requiredOption(
		"-c, --compare <value>",
		"Path to directory of images top-half of faces can be compared. This will detect the IDs for each of the input images."
	);
	program.requiredOption(
		"--beards <value>",
		"Path to directory of images where beards have been successfully processed. Must include the index.json file indicating beard enhancement types."
	);
	program.requiredOption(
		"--beards-index <value>",
		"Path to the index.json file indicating the processed beard enhancement types."
	);
});
const {
	inspectObject,
	stripTrailingSlash,
	getImages,
	getName,
	copy
} = require("../utils");
const levenDistance = require("../utils/leven");

console.log(chalk.yellow(`Starting beard detection ...`));

// The input directory of images is the Exported images.
// The compare directory of images is the original/imported/pre-enhanced images.
const { input, compare: compareDir, beards: beardsDir, beardsIndex } = options;
const outputDir = `${stripTrailingSlash(
	options.output || input
)}-beards-detected`;
mkdirp.sync(outputDir);

console.log(chalk.yellow(`Output directory created ...`));

(async () => {
	const sourceImages = await getImages(input);
	const compareImages = await getImages(compareDir);
	const beardsImages = await getImages(beardsDir);
	const beardsEnhancements = await jsonfile.readFile(beardsIndex);
	console.log(chalk.yellow(`Images and data obtained ...`));

	const newIndex = [];

	const q = new Queue(
		async ({ image }) => {
			// Turn the image into two halves, top and bottom
			const dimensions = await sizeOf(image);
			const topHalf = await sharp(image)
				.extract({
					top: 0,
					left: 0,
					width: dimensions.width,
					height: dimensions.height / 2
				})
				.toBuffer();
			const bottomHalf = await sharp(image)
				.extract({
					top: dimensions.height / 2,
					left: dimensions.width * 0.2,
					width: dimensions.width - dimensions.width * 0.4,
					height: dimensions.height / 2
				})
				.toBuffer();
			// await sharp(image)
			// 	.extract({
			// 		top: 0,
			// 		left: 0,
			// 		width: dimensions.width,
			// 		height: dimensions.height / 2
			// 	})
			// 	.toFile(path.join(outputDir, `TOP_${path.basename(image)}`));
			// await sharp(image)
			// 	.extract({
			// 		top: dimensions.height / 2,
			// 		left: 0,
			// 		width: dimensions.width,
			// 		height: dimensions.height / 2
			// 	})
			// 	.toFile(path.join(outputDir, `BOTTOM_${path.basename(image)}`));

			console.log(chalk.grey(`[${image}] Source image halved ...`));

			const topHash = await imghash.hash(topHalf);
			const match = {}; // distance, id -- to populate this object.
			for (let i = 0; i < compareImages.length; i += 1) {
				const imgPath = compareImages[i];
				const dim = await sizeOf(imgPath);
				const img = await sharp(imgPath)
					.extract({
						top: 0,
						left: 0,
						width: dim.width,
						height: dim.height / 2
					})
					.toBuffer();
				const cmpHash = await imghash.hash(img);
				const distance = levenDistance(topHash, cmpHash);
				const id = getName(imgPath);
				if (
					distance < match.distance ||
					typeof match.distance === "undefined"
				) {
					match.distance = distance;
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

			const bottomHash = await imghash.hash(bottomHalf);
			// Iterate over beard images and get the best match -- then determine the beard enhancement for this current input image
			const beardMatch = {}; // distance, id, enhancement -- to populate this object.
			for (let i = 0; i < beardsImages.length; i += 1) {
				const imgPath = beardsImages[i];
				const dim = await sizeOf(imgPath);
				const img = await sharp(imgPath)
					.extract({
						top: dim.height / 2,
						left: dim.width * 0.2,
						width: dim.width - dim.width * 0.4,
						height: dim.height / 2
					})
					.toBuffer();
				const cmpHash = await imghash.hash(img);
				const distance = levenDistance(bottomHash, cmpHash);
				const id = getName(imgPath);
				if (
					distance < beardMatch.distance ||
					typeof beardMatch.distance === "undefined"
				) {
					beardMatch.distance = distance;
					beardMatch.id = id;
				}
				console.log(
					chalk.grey(`[${image}] Compare with ${path.basename(imgPath)} ...`)
				);
			}

			const enhancementsRecord = beardsEnhancements.find(
				(enh) => enh.id === beardMatch.id
			);

			if (enhancementsRecord) {
				console.log(
					chalk.grey(`[${image}] Enhancements detected ${beardMatch.id} ...`),
					enhancementsRecord.enhancements
				);
			} else {
				console.log(chalk.red(`[${image}] Enhancements not found ...`));
			}

			// Copy the image to the new directory with the new id as the name.
			const destination = path.join(
				outputDir,
				`${match.id}${path.extname(image)}`
			);
			await copy(image, destination);

			console.log(chalk.grey(`[${image}] Image written to ${destination}`));

			newIndex.push({
				id: match.id,
				enhancements: enhancementsRecord.enhancements,
				enhancedImagePath: destination
			});

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

	// Write the new index.json to the output directory.
	console.log(chalk.green(`Writing new index.json to output directory!`));
	await jsonfile.writeFile(path.join(outputDir, "index.json"), newIndex);

	console.log(chalk.green(`All done!`));
})();

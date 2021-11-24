/**
 * Step 2.2 -- An optional step
 * Accessorise the Human Avatars
 */

const path = require("path");
const fs = require("fs").promises;
const chalk = require("chalk");
const mkdirp = require("mkdirp");
const glob = require("glob-promise");
const util = require("util");
const sharp = require("sharp");
const debugLog = require("debug")("avatar-accessorise");
const jsonfile = require("jsonfile");
const _ = require("lodash");
const clone = require("deep-clone");

const Queue = require("../queue");
const options = require("../options")();
const getCoords = require("./coords");
const getAccessories = require("./accessories");

const { input } = options;

sharp.cache(false);

// Unique Id for Folder to store files in...
const currentTs = Date.now();
const outputDir = path.resolve(__dirname, `../../output/step2.2/${currentTs}`);

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

	const accessoriesAdded = {};
	const accessories = await getAccessories(); // calculates dimensions.

	const q = new Queue(
		async ({ image }) => {
			// 1. Establish the queue handler
			const outputFile = path.join(outputDir, path.basename(image));
			const filename = path.basename(image).replace(/\.[^/.]+$/, ""); // Regex to remove the extension.
			const awsFrFilepath = path.join(
				__dirname,
				`../../data/aws/${filename}.json`
			);
			const awsFrData = await jsonfile.readFile(awsFrFilepath);

			// 2. Identify which way the avatar is facing
			const facialLandmarks = _.get(awsFrData, "FaceDetails[0].Landmarks", []);
			const noseLandmark = facialLandmarks.find(
				({ Type: type }) => type === "nose"
			);
			if (_.isEmpty(noseLandmark)) {
				throw new Error(
					`Cannot find the Nose Landmark for image ${image} - ${awsFrFilepath}`
				);
			}
			const isFacingLeft = noseLandmark.X < 0.5;
			const stickerDirection = isFacingLeft ? "left" : "right";

			const coords = await getCoords(image, awsFrData);

			// 4. Duplicate/Clone the accessories and randomly re-order to ensure that all accessories have the same opportunity to apply to the avatar
			const cAccessories = _.shuffle(clone(accessories));

			// 5. Set up composite input settings for sharp -- Iterate over the accessories
			// TODO: Include some checks -- such as age -- before adding a cigarette/vape.
			const composite = [];
			cAccessories.forEach((accessory) => {
				// Only add accessory if there is not pre-existing accessory in that facial location and the probability check is met
				const filledLocations = composite.map(({ location }) => location); // array of filled locations.
				const availableLocations = [];
				accessory.locations.forEach((location) => {
					if (!filledLocations.includes(location)) {
						availableLocations.push(location);
					}
				});
				if (availableLocations.length === 0) {
					return;
				}
				const selectedLocation =
					availableLocations[
						Math.floor(Math.random() * availableLocations.length)
					];

				const addAccessory = Math.random() < accessory.probability;
				if (!addAccessory) {
					return;
				}

				let settings = {};
				const sticker = accessory.sticker[stickerDirection];
				let featureCoords = {};
				switch (selectedLocation) {
					case "mouth": {
						featureCoords = coords.forMouth();
						break;
					}
					case "nose": {
						featureCoords = coords.forNose();
						break;
					}
					case "glabella": {
						featureCoords = coords.forGlabella();
						break;
					}
					case "eye-right": {
						featureCoords = coords.forEyeRight();
						break;
					}
					case "eye-left": {
						featureCoords = coords.forEyeLeft();
						break;
					}
					case "chin-right": {
						featureCoords = coords.forChinRight();
						break;
					}
					case "chin-left": {
						featureCoords = coords.forChinLeft();
						break;
					}
					case "forehead-right": {
						featureCoords = coords.forForeheadRight();
						break;
					}
					case "forehead-left": {
						featureCoords = coords.forForeheadLeft();
						break;
					}
					case "neck-right": {
						featureCoords = coords.forNeckRight();
						break;
					}
					case "neck-left": {
						featureCoords = coords.forNeckLeft();
						break;
					}
					default: {
						break;
					}
				}

				if (_.isEmpty(featureCoords)) {
					debugLog({ selectedLocation, featureCoords });
					settings = {
						left: Math.round(featureCoords.x - sticker.x),
						top: Math.round(featureCoords.y - sticker.y)
					};
					return;
				}

				composite.push({
					accessory,
					settings: {
						input: sticker.path,
						...settings
					}
				});

				if (_.isUndefined(accessoriesAdded[filename])) {
					accessoriesAdded[filename] = [];
				}
				accessoriesAdded[filename].push(accessory.name);
			});

			// Then queue the image composite edit -- // Only pass the array of settings to Sharp
			await sharp(image)
				.composite(composite.map(({ settings }) => settings))
				.toFile(outputFile);

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

	await jsonfile.writeFile(path.join(outputDir, "info.json"), {
		script: "accessorise",
		ts: currentTs,
		source: input,
		output: outputDir,
		count: sourceImages.length,
		accessoriesAdded
	});

	console.log(chalk.green(`All done!`));
})();

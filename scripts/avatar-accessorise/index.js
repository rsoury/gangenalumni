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
const options = require("../options")((program) => {
	program.option(
		"--all-options",
		"Flag to remove the probability/chance checks."
	);
	program.option(
		"--indicate",
		"Flag to indicate with markers where each of the landmarks are on the avatar."
	);
});
const getCoords = require("./coords");
const getAccessories = require("./accessories");
const { inspectObject } = require("../utils");
const addLandmarkIndicators = require("./indicate");

const { input, allOptions, indicate } = options;

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
			//* Use the Roll, Pitch and Yaw metrics to potentially determine which locations to blacklist
			// https://www.researchgate.net/figure/The-head-pose-rotation-angles-Yaw-is-the-rotation-around-the-Y-axis-Pitch-around-the_fig1_281587953#:~:text=Yaw%20is%20the%20rotation%20around%20the%20Y%2Daxis.,-Pitch%20around%20the
			const yaw = _.get(awsFrData, "FaceDetails[0].Pose.Yaw");
			if (_.isUndefined(yaw)) {
				throw new Error(
					`Cannot find the Yaw for image ${image} - ${awsFrFilepath}`
				);
			}
			const isFacingLeft = yaw < 0;
			const allLocations = accessories.reduce((accumulator, currentValue) => {
				currentValue.locations.forEach((location) => {
					if (!accumulator.includes(location)) {
						accumulator.push(location);
					}
				});
				return accumulator;
			}, []);
			let blacklistedLocations = [];
			if (yaw > 15) {
				// Facing super to the right -- blacklist all "-left" locations
				blacklistedLocations = allLocations.map(
					(location) => !location.includes("-left")
				);
			} else if (yaw < -15) {
				// Facing super to the left -- blacklist all "-right" locations
				blacklistedLocations = allLocations.map(
					(location) => !location.includes("-right")
				);
			}

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
					if (
						!filledLocations.includes(location) &&
						!blacklistedLocations.includes(location)
					) {
						availableLocations.push(location);
					}
				});
				if (availableLocations.length === 0) {
					return;
				}

				// Random location selection
				const selectedLocation =
					availableLocations[
						Math.floor(Math.random() * availableLocations.length)
					];

				// Some sticker directions are determined by the pose, others by symmetry -- symmetry means that the sticker should look the same regardless of pose, but depending on which side of the face it is being used.
				const stickerDirection = (
					accessory.directionBy === "pose"
						? isFacingLeft
						: selectedLocation.includes("-left")
				)
					? "left"
					: "right";

				const addAccessory =
					allOptions || Math.random() < accessory.probability;
				if (!addAccessory) {
					return;
				}

				debugLog(
					inspectObject({
						// accessory: accessory.name,
						accessory,
						addAccessory,
						selectedLocation,
						availableLocations,
						blacklistedLocations,
						filledLocations
					})
				);

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
						return; // TESTING
						/* eslint-disable */
						featureCoords = coords.forForeheadRight();
						break;
					}
					case "forehead-left": {
						return; // TESTING
						featureCoords = coords.forForeheadLeft();
						break;
					}
					case "neck-right": {
						return; // TESTING
						featureCoords = coords.forNeckRight();
						break;
					}
					case "neck-left": {
						return; // TESTING
						featureCoords = coords.forNeckLeft();
						/* eslint-enable */
						break;
					}
					default: {
						break;
					}
				}

				if (_.isEmpty(featureCoords)) {
					return;
				}

				// TODO: Check if the featureCoords area matches the colour of the avatar's skin to prevent adding an accessory of hair, or some other inherit feature.
				// Is required in the circumstance an avatar is already wearing a hat, or has hair covering their forehead.
				// Skin can be observed by taking the pigment from the cheek on the same side that the avatar is facing.

				debugLog({ featureCoords, sticker });

				composite.push({
					location: selectedLocation,
					accessory,
					settings: {
						input: sticker.path,
						left: Math.round(featureCoords.x - sticker.x),
						top: Math.round(featureCoords.y - sticker.y)
					}
				});

				if (_.isUndefined(accessoriesAdded[filename])) {
					accessoriesAdded[filename] = {};
				}
				accessoriesAdded[filename][selectedLocation] = accessory.name;
			});

			// Then queue the image composite edit -- // Only pass the array of settings to Sharp
			await sharp(image)
				.composite(
					composite
						.map(({ settings }) => settings)
						.concat(
							indicate ? await addLandmarkIndicators(image, awsFrData) : []
						)
				)
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

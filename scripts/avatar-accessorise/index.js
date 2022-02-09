/**
 * Step 2.2 -- An optional step
 * Accessorise the Human Avatars
 */

const path = require("path");
const chalk = require("chalk");
const mkdirp = require("mkdirp");
const glob = require("glob-promise");
const util = require("util");
const sharp = require("sharp");
const debugLog = require("debug")("avatar-accessorise");
const jsonfile = require("jsonfile");
const _ = require("lodash");
const clone = require("deep-clone");
const sizeOf = require("image-size");
const hex2dec = require("hex2dec");
const colorDifference = require("color-difference");
const SegfaultHandler = require("segfault-handler");
const Jimp = require("jimp");

const Queue = require("../utils/queue");
const options = require("../utils/options")((program) => {
	program.requiredOption("-f, --face-data <value>", "Path to face dataset.");
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
const { inspectObject, getImages, getName } = require("../utils");
const addLandmarkIndicators = require("./indicate");

SegfaultHandler.registerHandler(
	path.resolve(__dirname, "../../accessories-crash.log")
);

const { input, faceData: faceDataInput, allOptions, indicate } = options;

sharp.cache(false);

// Unique Id for Folder to store files in...
const currentTs = Date.now();
const outputDir = path.resolve(__dirname, `../../output/step2.2/${currentTs}`);

debugLog(`Output Directory: ${outputDir}`);

// Create dir
mkdirp.sync(outputDir);

(async () => {
	const sourceImages = await getImages(input);
	const faceDataSources = await glob(`${faceDataInput}/*.json`, {
		absolute: true
	});

	debugLog(sourceImages);

	const accessoriesAdded = {};
	const accessories = await getAccessories(); // calculates dimensions.

	const q = new Queue(
		async ({ image }) => {
			// 1. Establish the queue handler
			const outputFile = path.join(outputDir, path.basename(image));
			const name = getName(image);
			const faceFilepath = faceDataSources.find((fp) => name === getName(fp));
			const faceData = await jsonfile.readFile(faceFilepath);

			const faceDetails = faceData.FaceDetails[0];

			// 2. Identify which way the avatar is facing
			//* Use the Roll, Pitch and Yaw metrics to potentially determine which locations to blacklist
			// https://www.researchgate.net/figure/The-head-pose-rotation-angles-Yaw-is-the-rotation-around-the-Y-axis-Pitch-around-the_fig1_281587953#:~:text=Yaw%20is%20the%20rotation%20around%20the%20Y%2Daxis.,-Pitch%20around%20the
			const yaw = faceDetails.Pose.Yaw;
			if (_.isUndefined(yaw)) {
				throw new Error(
					`Cannot find the Yaw for image ${image} - ${faceFilepath}`
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
				// Facing super to the right -- blacklist all "-right" locations
				blacklistedLocations = allLocations.filter((location) =>
					location.includes("-right")
				);
			} else if (yaw < -15) {
				// Facing super to the left -- blacklist all "-left" locations
				blacklistedLocations = allLocations.filter((location) =>
					location.includes("-left")
				);
			}

			const jImage = await Jimp.read(image);
			const getPixelColor = (x, y) => {
				const colorInt = jImage.getPixelColor(x, y);
				const hexWithAlpha = hex2dec.decToHex(`${colorInt}`, { prefix: false });
				const hex = hexWithAlpha.slice(0, -2);
				return hex;
			};
			const coords = await getCoords(image, faceData, getPixelColor);

			// 4. Duplicate/Clone the accessories and randomly re-order to ensure that all accessories have the same opportunity to apply to the avatar
			const cAccessories = _.shuffle(clone(accessories));

			// Get size & pixels for image for later use
			// const pixels = await getPixels(image);
			const dimensions = await sizeOf(image);
			const indicativeScanCompositeInput = [];

			// 5. Set up composite input settings for sharp -- Iterate over the accessories
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

				// Include some checks -- such as age -- before adding a cigarette/vape.
				const isUnderage =
					(faceDetails.AgeRange.Low + faceDetails.AgeRange.High) / 2 < 18;
				if (
					selectedLocation === "mouth" &&
					(isUnderage || faceDetails.MouthOpen.Value === false)
				) {
					return;
				}
				if (accessory.name.includes("tattoo") && isUnderage) {
					return;
				}

				// Some sticker directions are determined by the pose, others by symmetry -- symmetry means that the sticker should look the same regardless of pose, but depending on which side of the face it is being used.
				const stickerDirection = (
					accessory.directionBy === "pose"
						? isFacingLeft
						: selectedLocation.includes("-left")
				)
					? "left"
					: "right";

				const addAccessory =
					allOptions || Math.random() <= accessory.probability;
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
				// Ensure that cheek stickers can fit based on facial yaw
				if (
					sticker.dimensions.width / dimensions.width >= 0.1 &&
					((yaw > 10 && selectedLocation.includes("cheek-right")) ||
						(yaw < -10 && selectedLocation.includes("cheek-left")))
				) {
					return;
				}

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
					case "cheek-right": {
						featureCoords = coords.forCheekRight();
						break;
					}
					case "cheek-left": {
						featureCoords = coords.forCheekLeft();
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
					return;
				}

				//* Check if the featureCoords area matches the colour of the avatar's skin to prevent adding an accessory of hair, or some other inherit feature.
				// Is required in the circumstance an avatar is already wearing a hat, or has hair covering their forehead.
				// Skin can be observed by taking the pigment from the cheek/nose on the same side that the avatar is facing.
				if (!accessory.skipPigmentCheck) {
					const facialLandmarks = faceDetails.Landmarks;
					const { X: pigmentLandmarkX } =
						facialLandmarks.find(({ Type: type }) =>
							type === isFacingLeft ? "noseRight" : "noseLeft"
						) || {};
					const { Y: pigmentLandmarkY } =
						facialLandmarks.find(({ Type: type }) =>
							type === isFacingLeft ? "mouthRight" : "mouthLeft"
						) || {};
					if (
						_.isUndefined(pigmentLandmarkX) ||
						_.isUndefined(pigmentLandmarkY)
					) {
						throw new Error(
							`Cannot find the Pigment Landmark Values for image ${image}`
						);
					}
					const pigmentCoords = {
						x: Math.round(pigmentLandmarkX * dimensions.width),
						y: Math.round(pigmentLandmarkY * dimensions.height)
					};
					// const pigmentPixel = getPixel(pigmentCoords.x, pigmentCoords.y);
					// const referenceColor = rgbToHex(
					// 	pigmentPixel[0],
					// 	pigmentPixel[1],
					// 	pigmentPixel[2]
					// );
					const referenceColor = getPixelColor(
						pigmentCoords.x,
						pigmentCoords.y
					);
					// debugLog({ pigmentPixel, referenceColor });
					debugLog({ referenceColor });

					// Iterate over the pixels in the area that is overlapped by the composite image.
					// -- 1. Extract that area out of the original image using Sharp
					// -- 2. Iterate over every pixel using getImageData on each coordinate within that extracted image.
					// -- 3. If a percentage of the pixels are not within this color distance threshold, then skip the accessory.
					// We can save these temp extracted images to disk for testing purposes.

					const extract = {
						left: Math.round(featureCoords.x - sticker.x),
						top: Math.round(featureCoords.y - sticker.y),
						width: sticker.dimensions.width,
						height: sticker.dimensions.height
					};
					const diff = [];
					for (let y = extract.top; y < extract.top + extract.height; y += 1) {
						for (
							let x = extract.left;
							x < extract.left + extract.width;
							x += 1
						) {
							// const scanPixel = getPixel(x, y);
							// const scanColor = rgbToHex(
							// 	scanPixel[0],
							// 	scanPixel[1],
							// 	scanPixel[2]
							// );
							const scanColor = getPixelColor(x, y);
							diff.push(colorDifference.compare(referenceColor, scanColor));
						}
					}
					if (indicate) {
						// Add a soft layer indicating which area of the face was scanned.
						indicativeScanCompositeInput.push({
							input: {
								create: {
									width: extract.width,
									height: extract.height,
									channels: 4,
									background: "rgba(16, 247, 12, 0.1)" // #10f70c
								}
							},
							left: extract.left,
							top: extract.top
						});
						// Add a pigment pixel indicator
						indicativeScanCompositeInput.push({
							input: {
								create: {
									width: 10,
									height: 10,
									channels: 3,
									background: "#000000"
								}
							},
							left: Math.round(dimensions.width * pigmentLandmarkX - 5),
							top: Math.round(dimensions.height * pigmentLandmarkY - 5),
							blend: "add"
						});
					}
					const colorDistanceThreshold = 15;
					const thresholdBreachCount = diff.reduce(
						(accumulator, currentValue) => {
							if (currentValue >= colorDistanceThreshold) {
								accumulator += 1;
							}
							return accumulator;
						},
						0
					);
					const areaScanRatio = thresholdBreachCount / diff.length;
					debugLog({ thresholdBreachCount, areaScanRatio });
					if (areaScanRatio > 0.1) {
						return;
					}
				}

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

				if (_.isUndefined(accessoriesAdded[name])) {
					accessoriesAdded[name] = {};
				}
				accessoriesAdded[name][selectedLocation] = accessory.name;
			});

			// Sort the composite elements by the accessory elevate value in ascending order -- this way highest elevate value is added last.
			composite.sort(
				(
					{ accessory: { elevate: elevate1 } },
					{ accessory: { elevate: elevate2 } }
				) => {
					return elevate1 - elevate2;
				}
			);
			// debugLog(
			// 	composite.map(({ accessory: { name, elevate } }) => ({ name, elevate }))
			// );

			// Then queue the image composite edit -- // Only pass the array of settings to Sharp
			await sharp(image)
				.composite(
					composite
						.map(({ settings }) => settings)
						.concat(
							indicate
								? [
										...indicativeScanCompositeInput,
										...(await addLandmarkIndicators(image, faceData))
								  ]
								: []
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

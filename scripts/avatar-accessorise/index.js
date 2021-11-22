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
const sizeOf = require("image-size");
const jsonfile = require("jsonfile");
const _ = require("lodash");

const Queue = require("../queue");
const options = require("../options")();
const stickers = require("./stickers");

const { input, s3 } = options;

sharp.cache(false);

// Unique Id for Folder to store files in...
const currentTs = Date.now();
const outputDir = path.resolve(__dirname, `../../output/step2.2/${currentTs}`);

debugLog(`Output Directory: ${outputDir}`);

// const s3Split = s3.replace("s3://", "").split("/");
// const s3BucketName = s3Split.shift();
// const s3BucketKey = s3Split.join("/");
// const s3Client = new S3({ params: { Bucket: s3BucketName } });

let sourceImages = [];

const accessoryProbability = [
	{
		name: "cigarette",
		type: "mouth",
		// value: 0.1
		value: 1 // 100% for testing purposes.
	}
];

if (!s3) {
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

		const q = new Queue(
			async ({ image }) => {
				const outputFile = path.join(outputDir, path.basename(image));
				const filename = path.basename(image).replace(/\.[^/.]+$/, ""); // Regex to remove the extension.
				const dimensions = await sizeOf(image);
				const awsFrFilepath = path.join(
					__dirname,
					`../../data/aws/${filename}.json`
				);
				const awsFrData = await jsonfile.readFile(awsFrFilepath);

				const facialLandmarks = _.get(
					awsFrData,
					"FaceDetails[0].Landmarks",
					[]
				);
				const noseLandmark = facialLandmarks.find(
					({ Type: type }) => type === "nose"
				);
				if (_.isEmpty(noseLandmark)) {
					throw new Error(
						`Cannot find the Nose Landmark for image ${image} - ${awsFrFilepath}`
					);
				}
				// const noseCoords = { x: noseLandmark.X * dimensions.width, y: noseLandmark.Y * dimensions.height }
				const isFacingLeft = noseLandmark.X < 0.5;
				const stickersToUse = isFacingLeft
					? stickers.faceLeft
					: stickers.faceRight;

				// // Check mouth open before adding any mouth accessories -- ie. cigarette or vape.
				// const mouthOpen = _.get(awsFrData, "FaceDetails.MouthOpen", {})
				// if (_.isEmpty(mouthOpen)) {
				// 	throw new Error(
				// 		`Cannot find the Mouth Open prediction for image ${image} - ${awsFrFilepath}`
				// 	);
				// }
				// if(!mouthOpen.Value){
				// 	return;
				// }

				// Then get the mouth landmark to determine the coordinates
				const mouthBottomLandmark = facialLandmarks.find(
					({ Type: type }) => type === "mouthDown"
				);
				if (_.isEmpty(mouthBottomLandmark)) {
					throw new Error(
						`Cannot find the Mouth Bottom Landmark for image ${image} - ${awsFrFilepath}`
					);
				}
				const mouthTopLandmark = facialLandmarks.find(
					({ Type: type }) => type === "mouthUp"
				);
				if (_.isEmpty(mouthTopLandmark)) {
					throw new Error(
						`Cannot find the Mouth Top Landmark for image ${image} - ${awsFrFilepath}`
					);
				}
				const mouthBottomCoords = {
					x: mouthBottomLandmark.X * dimensions.width,
					y: mouthBottomLandmark.Y * dimensions.height
				};
				const mouthTopCoords = {
					x: mouthTopLandmark.X * dimensions.width,
					y: mouthTopLandmark.Y * dimensions.height
				};
				// Deduce center of mouth coords -- or just below the top of the mouth
				const mouthCoords = {
					x:
						mouthTopCoords.x +
						((mouthBottomCoords.x - mouthTopCoords.x) / 8) * 5,
					y:
						mouthTopCoords.y +
						((mouthBottomCoords.y - mouthTopCoords.y) / 8) * 5
				};
				debugLog({ mouthCoords });
				// Then queue the image composite edit
				await sharp(image)
					.composite([
						{
							input: stickersToUse.cigarette.path,
							left: Math.round(mouthCoords.x - stickersToUse.cigarette.x),
							top: Math.round(mouthCoords.y - stickersToUse.cigarette.y)
						}
					])
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

		// TODO: We're going to have to include the data around which image receivied which accessories to enhance the NFT metadata
		await fs.writeFile(
			path.join(outputDir, "info.json"),
			JSON.stringify({
				script: "accessorise",
				ts: currentTs,
				source: input,
				output: outputDir,
				count: sourceImages.length
			})
		);

		console.log(chalk.green(`All done!`));
	})();
}

/**
 * This script requires:
 * - OBS with a Scene that includes an Image Source named "Image"
 * - Snap Camera
 */

const path = require("path");
// const { S3 } = require("aws-sdk");
const fs = require("fs").promises;
const chalk = require("chalk");
const ono = require("ono");
const mkdirp = require("mkdirp");
const glob = require("glob-promise");
const util = require("util");
const OBSWebSocket = require("obs-websocket-js");
const os = require("os");
const sharp = require("sharp");
const del = require("del");
const { exec } = require("child-process-promise");
const debugLogger = require("debug")("avatar-filter");

const options = require("./options");

const { input, s3 } = options;

const delay = (timeout) =>
	new Promise((resolve) => {
		setTimeout(() => {
			resolve();
		}, timeout);
	});

// Unique Id for Folder to store files in...
const currentTs = Date.now();
const outputDir = path.resolve(__dirname, `../../output/step2/${currentTs}`);

// const s3Split = s3.replace("s3://", "").split("/");
// const s3BucketName = s3Split.shift();
// const s3BucketKey = s3Split.join("/");
// const s3Client = new S3({ params: { Bucket: s3BucketName } });

let sourceImages = [];

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
			sourceImages = await glob(`${input}/*`, { absolute: true });
		}

		debugLogger(sourceImages);

		// For each image
		// 1. Set a OBS scene image source file.
		// 2. Execute Snap Camera using Golang and RobotGO
		// 3. Resize the image programmatically to remove the excess background and produce a 720 × 720 -- https://github.com/lovell/sharp

		const obs = new OBSWebSocket();
		await obs.connect({ password: "x5Wh98fTfUauQ9Ms" });
		console.log(
			chalk.green(`Success! We're connected & authenticated with OBS.`)
		);

		const sourceName = `Image`;
		const snapOutputDir = path.join(os.homedir(), "/Pictures");
		// Get existing snap output images and mark the start of the next few.
		const snapImages = await glob(
			path.join(snapOutputDir, `/Snap Camera Photo*`),
			{ absolute: true }
		);
		debugLogger(`platform: ${process.platform}`);
		debugLogger(`homedir: ${os.homedir()}`);
		debugLogger(`Snap output dir: ${snapOutputDir}`);

		for (let i = 0; i < 1; i += 1) {
			try {
				// Set OBS image source file
				await obs.send("SetSourceSettings", {
					sourceName,
					sourceSettings: {
						file: sourceImages[i]
					}
				});

				// Use RobotJS to manipulate Snap Camera -- Going to use a Hotkey... so we just need to emulate the keyboard action...
				// robot.keyTap("j", [
				// 	"shift",
				// 	// process.platform === "darwin" ? "command" : "control" // Command on Mac, Control on Win
				// 	"control"
				// ]);
				// robot.keyToggle("shift", "down");
				// SnapCamera.TakePhoto();
				await exec(path.resolve(__dirname, "../../bin/snapcamera")); // Execute binary produced from main.go in root.

				await delay(500);

				const snapIndex = snapImages.length + i;
				debugLogger(`Snap output image: ${snapIndex}`);
				const snapOutputImage = path.join(
					snapOutputDir,
					`/Snap Camera Photo${snapIndex === 0 ? "" : ` ${snapIndex + 1}`}.jpg`
				);
				const outputFile = path.join(outputDir, path.basename(sourceImages[i]));

				debugLogger(`Snap output image: ${snapOutputImage}`);

				try {
					await fs.access(snapOutputImage, fs.F_OK);
				} catch (err) {
					throw ono(err, `Cannot find file ${snapOutputImage}`);
				}

				// Resize the output file.
				await sharp(snapOutputImage)
					.extract({ width: 720, height: 720, top: 0, left: 0 })
					.toFile(outputFile);

				// Clean the SnapOutput File
				await del(snapOutputImage, { force: true });

				console.log(
					`Successfully filtered image ${path.basename(sourceImages[i])}`
				);
			} catch (err) {
				console.log(chalk.red(`Error! Could not process image`));
				console.error(util.inspect(err, false, null, true));
			}
		}

		await obs.disconnect();
		console.log(chalk.green(`All done!`));
	})();
}

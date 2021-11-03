/**
 * This script requires:
 * - OBS with a Scene that includes an Image Source named "Image"
 * - Snap Camera
 */

const path = require("path");
// const { S3 } = require("aws-sdk");
const fs = require("fs").promises;
const chalk = require("chalk");
// const ono = require("ono");
const mkdirp = require("mkdirp");
const glob = require("glob-promise");
const util = require("util");
const OBSWebSocket = require("obs-websocket-js");
const robot = require("robotjs"); // Requires Node 12
const os = require("os");
const sharp = require("sharp");
const del = require("del");

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
const outputDir = path.resolve(__dirname, "../../output/step2");

// const s3Split = s3.replace("s3://", "").split("/");
// const s3BucketName = s3Split.shift();
// const s3BucketKey = s3Split.join("/");
// const s3Client = new S3({ params: { Bucket: s3BucketName } });

let sourceImages = [];

if (!s3) {
	// Create dir
	mkdirp.sync(path.resolve(outputDir, `filtered--${currentTs}`));

	(async () => {
		const stat = await fs.lstat(input);
		if (stat.isFile()) {
			// Use file as image
			sourceImages.push(path.resolve(input));
		} else {
			// Get images from directory
			sourceImages = await glob(`${input}/*`, { absolute: true });
		}

		console.log(sourceImages);

		// For each image
		// 1. Set a OBS scene image source file.
		// 2. Find Snap Camera window coordinates and bring to surface.
		// 3. Execute Snap Camera using Robotjs
		// 		RobotsJS only has functionality to move the cursor around.
		// // 3. Remove the green screen background.
		// 4. Resize the image programmatically to remove the excess background and produce a 720 × 720 -- https://github.com/lovell/sharp

		try {
			const obs = new OBSWebSocket();
			await obs.connect({ password: "x5Wh98fTfUauQ9Ms" });
			console.log(
				chalk.green(`Success! We're connected & authenticated with OBS.`)
			);

			// TODO: Find Snap Camera window coordinates and bring to surface. -- Only needs to be done once.

			const sourceName = `Image`;
			const snapOutputDir = path.resolve(os.homedir(), "/Pictures");
			// Get existing snap output images and mark the start of the next few.
			const snapImages = await glob(
				path.resolve(snapOutputDir, `/Snap Camera Photo*`),
				{ absolute: true }
			);

			for (let i = 0; i < 1; i += 1) {
				// Set OBS image source file
				await obs.send("SetSourceSettings", {
					sourceName,
					sourceSettings: {
						file: sourceImages[i]
					}
				});

				// Use RobotJS to manipulate Snap Camera -- Going to use a Hotkey... so we just need to emulate the keyboard action...
				robot.keyTap("j", [
					"shift",
					process.platform === "darwin" ? "command" : "control" // Command on Mac, Control on Win
				]);

				await delay(500);

				const snapIndex = snapImages.length + i;
				const snapOutputImage = path.resolve(
					snapOutputDir,
					`/Snap Camera Photo${snapIndex === 0 ? "" : ` ${snapIndex}`}.jpg`
				);

				// Resize the output file.
				await sharp(snapOutputImage)
					.resize(720)
					.toFile(path.resolve(__dirname, path.basename(sourceImages[i])));

				// Clean the SnapOutput File
				await del(snapOutputImage);
			}

			await obs.disconnect();
		} catch (err) {
			console.error(chalk.red(util.inspect(err, false, null, true)));
		}
	})();
}

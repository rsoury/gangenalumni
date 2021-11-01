const path = require("path");
const { S3 } = require("aws-sdk");
const fs = require("fs").promises;
const chalk = require("chalk");
// const ono = require("ono");
const mkdirp = require("mkdirp");
const glob = require("glob-promise");
const util = require("util");
const OBSWebSocket = require("obs-websocket-js");

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
const outputDir = path.resolve(__dirname, "../../output");

const s3Split = s3.replace("s3://", "").split("/");
const s3BucketName = s3Split.shift();
const s3BucketKey = s3Split.join("/");
const s3Client = new S3({ params: { Bucket: s3BucketName } });

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
		// 2. Execute Snap Camera.
		// 3. Remove the green screen background.

		try {
			const obs = new OBSWebSocket();
			await obs.connect({ password: "x5Wh98fTfUauQ9Ms" });
			console.log(
				chalk.green(`Success! We're connected & authenticated with OBS.`)
			);

			const sourceName = `Image`;
			await obs.send("SetSourceSettings", {
				sourceName,
				sourceSettings: {
					file: sourceImages[8]
				}
			});

			await obs.disconnect();
		} catch (err) {
			console.error(chalk.red(util.inspect(err, false, null, true)));
		}
	})();
}

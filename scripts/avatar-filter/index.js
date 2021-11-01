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

// Unique Id for Folder to store files in...
const currentTs = Date.now();
const outputDir = path.resolve(__dirname, "../../output");

const s3Split = s3.replace("s3://", "").split("/");
const s3BucketName = s3Split.shift();
const s3BucketKey = s3Split.join("/");
const s3Client = new S3({ params: { Bucket: s3BucketName } });

if (!s3) {
	// Create dir
	mkdirp.sync(path.resolve(outputDir, `filtered--${currentTs}`));

	(async () => {
		const stat = await fs.lstat(input);
		let sourceImages = [];
		if (stat.isFile()) {
			// Use file as image
			sourceImages.push(path.resolve(input));
		} else {
			// Get images from directory
			sourceImages = await glob(`${input}/*`, { absolute: true });
		}

		console.log(sourceImages);

		// For each image
		// 1. set a OBS scene
		// 2. Execute Snap Camera
		// 3. Remove the green screen background.

		try {
			const obs = new OBSWebSocket();
			await obs.connect({ password: "x5Wh98fTfUauQ9Ms" });
			console.log(
				chalk.green(`Success! We're connected & authenticated with OBS.`)
			);
			const currentScene = await obs.send("GetCurrentScene");
			console.log(currentScene);

			const sourceName = `Auto Image ${Date.now()}`;
			const imageSource = await obs.send("CreateSource", {
				sourceName,
				sourceKind: "image_source",
				sceneName: currentScene.name,
				sourceSettings: {
					file: sourceImages[0]
				}
			});

			console.log(imageSource);

			// const sourceSettings = await obs.send("GetSourceSettings", {
			// 	sourceName
			// });
			// console.log(sourceSettings);
			// const sourceSettings = await obs.send("SetSourceSettings", {
			// 	sourceName
			// });
			// console.log(sourceSettings);

			await obs.send("SetSceneItemProperties", {
				item: {
					id: imageSource.itemId
				},
				bounds: {
					type: "OBS_BOUNDS_SCALE_TO_HEIGHT"
				},
				position: {
					alignment: 1
				}
			});

			await obs.disconnect();
		} catch (err) {
			console.error(chalk.red(util.inspect(err, false, null, true)));
		}
	})();
}

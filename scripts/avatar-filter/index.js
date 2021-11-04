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
const os = require("os");
const sharp = require("sharp");
const del = require("del");
const { exec } = require("child-process-promise");
const Queue = require("better-queue");
const chokidar = require("chokidar");
const debugLogger = require("debug")("avatar-filter");

const options = require("./options");

const { input, s3 } = options;

const delay = (timeout) =>
	new Promise((resolve) => {
		setTimeout(() => {
			resolve();
		}, timeout);
	});

sharp.cache(false);

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

		const q = new Queue(
			({ image, i }, done) => {
				(async () => {
					// Set OBS image source file
					await obs.send("SetSourceSettings", {
						sourceName,
						sourceSettings: {
							file: image
						}
					});

					await delay(500);

					await exec(path.resolve(__dirname, "../../bin/snapcamera")); // Execute binary produced from main.go in root.

					// Remove snapIndex and file increment as the Snap output file is cleaned at the end of the process.
					const snapOutputFilename = `Snap Camera Photo${
						snapImages.length === 0 ? "" : ` ${snapImages.length + 1}`
					}.jpg`;
					const snapOutputImage = path.join(snapOutputDir, snapOutputFilename);
					const outputFile = path.join(outputDir, path.basename(image));

					debugLogger(`Snap output image: ${snapOutputImage}`);

					await delay(500); // Buffer for the image creation...

					try {
						await fs.access(snapOutputImage, fs.F_OK);
					} catch (err) {
						// throw ono(err, `Cannot find file ${snapOutputImage}`);

						// Wait for the Snap Image to appear.
						// If there is a timeout, then error...
						await new Promise((resolve, reject) => {
							let timeout;
							const watcher = chokidar
								.watch(snapOutputDir)
								.on("file", (event, newPath) => {
									if (path.basename(newPath) === snapOutputFilename) {
										clearTimeout(timeout);
										resolve();
									}
								});
							timeout = setTimeout(() => {
								watcher.unwatch();
								reject(new Error(`Cannot find file ${snapOutputImage}`));
							}, 15000);
						});
					}

					// Resize the output file.
					await sharp(snapOutputImage)
						.extract({ width: 720, height: 720, top: 0, left: 0 })
						.toFile(outputFile);

					// Clean the SnapOutput File
					await del(snapOutputImage, { force: true });

					return image;
				})()
					.then((resp) => {
						done(null, resp);
					})
					.catch((err) => {
						done(err);
					});
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
			console.log(`Successfully filtered image ${result}`);
		});

		await new Promise((resolve) => {
			q.on("drain", () => {
				resolve();
			});
		});

		await obs.disconnect();
		console.log(chalk.green(`All done!`));
	})();
}

/**
 * Step 4
 * Modulate the Human Avatars using Sharp (Node.js)
 */

const path = require("path");
const fs = require("fs").promises;
const chalk = require("chalk");
const mkdirp = require("mkdirp");
const glob = require("glob-promise");
const util = require("util");
const sharp = require("sharp");
const Queue = require("better-queue");
const debugLog = require("debug")("avatar-modulate");

const options = require("./options");

const { input, s3 } = options;

sharp.cache(false);

// Unique Id for Folder to store files in...
const currentTs = Date.now();
const outputDir = path.resolve(__dirname, `../../output/step4/${currentTs}`);

debugLog(`Output Directory: ${outputDir}`);

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
			sourceImages = await glob(`${input}/*.{jpeg,jpg,png}`, {
				absolute: true
			});
		}

		debugLog(sourceImages);

		const q = new Queue(
			({ image }, done) => {
				(async () => {
					const outputFile = path.join(outputDir, path.basename(image));

					// Modulate the file.
					await sharp(image)
						.modulate({ hue: 10, saturation: 1.2 })
						.toFile(outputFile);

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
			console.log(`Successfully processed image ${result}`);
		});

		await new Promise((resolve) => {
			q.on("drain", () => {
				resolve();
			});
		});

		await fs.writeFile(
			path.join(outputDir, "info.json"),
			JSON.stringify({
				script: "filter",
				ts: currentTs,
				source: input,
				output: outputDir,
				count: sourceImages.length
			})
		);

		console.log(chalk.green(`All done!`));
	})();
}

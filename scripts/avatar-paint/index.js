/**
 * Step 3
 *
 * Process the Filtered Avatars through AI Illustration Refinement/Filter/Painting-processor
 *
 * We're going to need to use a Google Trigger to read the Prisma Auth Email and then Forward to a nGrok Tunnel
 * Or use a Google API -- https://developers.google.com/gmail/api/quickstart/nodejs
 */

const path = require("path");
// const { S3 } = require("aws-sdk");
const fs = require("fs").promises;
const chalk = require("chalk");
// const ono = require("ono");
const mkdirp = require("mkdirp");
const glob = require("glob-promise");
const util = require("util");
const Queue = require("better-queue");
const debugLogger = require("debug")("avatar-paint");

const options = require("./options");
const gmail = require("./gmail");

const { input, s3 } = options;

const delay = (timeout) =>
	new Promise((resolve) => {
		setTimeout(() => {
			resolve();
		}, timeout);
	});

// Unique Id for Folder to store files in...
const currentTs = Date.now();
const outputDir = path.resolve(__dirname, `../../output/step3/${currentTs}`);

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
		// 1. Process through Prisma AI web interface -- use Puppeteer

		const q = new Queue(({ image, i }, done) => {});
	})();
}

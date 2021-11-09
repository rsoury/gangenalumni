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
const Queue = require("better-queue");
const debugLogger = require("debug")("avatar-paint");
// const puppeteer = require("puppeteer");

const options = require("./options");
const gmail = require("./gmail");
const puppeteer = require("./crawler");
const { inspectObject } = require("../utils");

const { input, s3, withUi } = options;

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

		// debugLogger(sourceImages);

		// For each image
		// 1. Process through Prisma AI web interface -- use Puppeteer

		// Initiate gmail auth here
		const gauth = await gmail.authorize();

		// Initiate pupeteer here.
		// Log into Prisma
		const browser = await puppeteer.launch({
			headless: typeof withUi === "undefined" ? true : !withUi
		});
		const page = await browser.newPage();
		await page.goto("https://app.prisma-ai.com/");
		// Wait for modal... if shows, close it.

		try {
			await page.waitForSelector(
				`body > div.sc-iCfLBT.cyKWiF.sc-lcequs.gYrNUP > div > div > button`,
				{ timeout: 5000 }
			);
			await page.click(
				`body > div.sc-iCfLBT.cyKWiF.sc-lcequs.gYrNUP > div > div > button`
			);
		} catch (err) {
			console.log(chalk.grey("No modal to close"));
		}
		// Look for Sign In button
		await page.waitForSelector(
			`#root > div > div.sc-dkYRiW.zAgBi > div > button`,
			{ timeout: 5000 }
		);
		await page.click(`#root > div > div.sc-dkYRiW.zAgBi > div > button`);
		await page.waitForSelector(
			`body > div.sc-iCfLBT.iWHGVD > div > div > div.sc-hiCivh.iUXnyj > form > div > div > div.sc-dPiKHq.jtMGgR > input`,
			{ timeout: 10000 }
		);
		await page.type(
			`body > div.sc-iCfLBT.iWHGVD > div > div > div.sc-hiCivh.iUXnyj > form > div > div > div.sc-dPiKHq.jtMGgR > input`,
			"ryan@webdoodle.com.au"
		);

		// Save the timestamp for when the Sign In Button is clicked
		const signInTs = Date.now();
		await page.click(
			`body > div.sc-iCfLBT.iWHGVD > div > div > div.sc-hiCivh.iUXnyj > form > button`
		);

		// Wait for code input modal to show
		await page.waitForSelector(`#field-0`, { timeout: 30000 });

		// Listen to gmail for new email from prisma
		const pauthUrl = await gmail.fetchPrismaAuth(gauth, signInTs);
		if (!pauthUrl) {
			throw new Error("Cannot authorise with Prisma");
		}
		debugLogger(`Auth URL: ${pauthUrl}`);

		// Go to the authorisation URL
		await page.goto(pauthUrl, { waitUntil: "domcontentloaded" });

		// Wait for the Profile Menu Item
		await page.waitForSelector(
			"#root > div > div.sc-dkYRiW.zAgBi > div > button.eRoEXR",
			{ timeout: 30000 }
		); // Wait for Profile "Secondary" Button

		// Proceed with the Batch Image Processing
		// const q = new Queue(
		// 	({ image }, done) => {
		// 		(async () => {
		// 			return image;
		// 		})()
		// 			.then((resp) => {
		// 				done(null, resp);
		// 			})
		// 			.catch((err) => {
		// 				done(err);
		// 			});
		// 	},
		// 	{
		// 		batchDelay: 1000
		// 	}
		// );

		// // Queue the images for filtering.
		// sourceImages.forEach((image, i) => {
		// 	q.push({ image, i });
		// });

		// q.on("task_failed", (taskId, err) => {
		// 	console.log(chalk.red(`[${taskId}] Could not process image`));
		// 	console.error(inspectObject(err));
		// });

		// q.on("task_finish", (taskId, result) => {
		// 	console.log(`Successfully painted image ${result}`);
		// });

		// await new Promise((resolve) => {
		// 	q.on("drain", () => {
		// 		resolve();
		// 	});
		// });

		// await page.close();
		// await browser.close();

		console.log(chalk.green(`All done!`));
	})();
}

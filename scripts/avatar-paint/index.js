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
const interval = require("interval-promise");

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
		// await page.click('#root > div > div.sc-cjrQaZ.bkqtbz > div > div.sc-gXRoDt.sc-bGaWHc.kjAuoY.fHoPRO > div > div.sc-bUbQrF.vQGyo > div.sc-djWQLY.QinlX > button')
		// await page.waitForTimeout(2000)
		// await page.type('#root > div > div.sc-cjrQaZ.bkqtbz > div > div.sc-gXRoDt.sc-bGaWHc.kjAuoY.fHoPRO > div > div.sc-bUbQrF.vQGyo > div.sc-djWQLY.QinlX > input', 'Melody')
		// await page.click('#root > div > div.sc-cjrQaZ.bkqtbz > div > div.sc-gXRoDt.sc-bGaWHc.kjAuoY.fHoPRO > div > div.sc-jlsrtQ.sc-hYQoDq.jTBRdI.fTqTJk > div > div.sc-cHzrye.kKMDjV > div')
		const [melodyCellElement] = await page.$x(
			`//div[contains(text(), 'Melody')]`
		);

		const imageUploadElement = await page.$(
			"#root > div > div.sc-cjrQaZ.bkqtbz > div > div.sc-gXRoDt.sc-fydGIT.kjAuoY.dUrBNr > div > div > div.sc-iFMAoI.dnQAZn > div.sc-FNZbm.kGBuQP > input[type=file]"
		);
		// const imageUploadButton = await page.$(
		// 	"#root > div > div.sc-cjrQaZ.bkqtbz > div > div.sc-gXRoDt.sc-fydGIT.kjAuoY.dUrBNr > div > div > div.sc-iFMAoI.dnQAZn > div.sc-FNZbm.kGBuQP > button"
		// );
		await page._client.send("Page.setDownloadBehavior", {
			behavior: "allow",
			downloadPath: outputDir
		});
		// Overlay: #root > div > div.sc-cjrQaZ.bkqtbz > div > div.sc-gXRoDt.sc-fydGIT.kjAuoY.dUrBNr > div > div > div.sc-kTLnJg.dYLStF > div
		const q = new Queue(
			({ image }, done) => {
				(async () => {
					// https://dev.to/sonyarianto/practical-puppeteer-how-to-upload-a-file-programatically-4nm4 -- Great article on how to manage file uploads in Pptr
					// Upload image
					imageUploadElement.uploadFile(image);
					// await imageUploadButton.click(); // Click on button to trigger the upload
					// Wait for image upload
					await interval(
						async (i, doneInterval) => {
							try {
								debugLogger(`Waiting for upload image - second ${i}`);
								await page.waitForSelector(
									"#root > div > div.sc-cjrQaZ.bkqtbz > div > div.sc-gXRoDt.sc-fydGIT.kjAuoY.dUrBNr > div > div.sc-jtXFOG.hSrftO",
									{ timeout: 1000 }
								);
							} catch (e) {
								debugLogger(`Image uploaded`);
								doneInterval();
							}
						},
						1100,
						{ interations: 60 }
					);
					// Click on Melody
					await melodyCellElement.click();
					// Wait for paint/filter process
					await interval(
						async (i, doneInterval) => {
							try {
								debugLogger(`Waiting for image paint - second ${i}`);
								await page.waitForSelector(
									"#root > div > div.sc-cjrQaZ.bkqtbz > div > div.sc-gXRoDt.sc-fydGIT.kjAuoY.dUrBNr > div > div > div.sc-kTLnJg.dYLStF > div",
									{ timeout: 1000 }
								);
							} catch (e) {
								debugLogger(`Image painted`);
								doneInterval();
							}
						},
						1100,
						{ interations: 60 }
					);
					// Download the painted image to the output dir -- https://www.scrapingbee.com/blog/download-file-puppeteer/
					await page.click(
						"#root > div > div.sc-cjrQaZ.bkqtbz > div > div.sc-gXRoDt.sc-fydGIT.kjAuoY.dUrBNr > div > div > div.sc-iFMAoI.dnQAZn > div.sc-iqVVwt.dWaGix > button"
					);

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
				batchDelay: 200
			}
		);

		// Queue the images for filtering.
		sourceImages.forEach((image, i) => {
			q.push({ image, i });
		});

		q.on("task_failed", (taskId, err) => {
			console.log(chalk.red(`[${taskId}] Could not process image`));
			console.error(inspectObject(err));
		});

		q.on("task_finish", (taskId, result) => {
			console.log(`Successfully painted image ${result}`);
		});

		await new Promise((resolve) => {
			q.on("drain", () => {
				resolve();
			});
		});

		// await page.close();
		// await browser.close();

		console.log(chalk.green(`All done!`));
	})();
}

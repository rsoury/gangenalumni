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
const debugLog = require("debug")("avatar-paint");
const interval = require("interval-promise");
const del = require("del");
const util = require("util");
const ncp = util.promisify(require("ncp"));

const options = require("../options")((program) => {
	program.option(
		"-w, --with-ui",
		"Option to show the browser during automation. Browser will run headlessly by default."
	);
});
const gmail = require("./gmail");
const puppeteer = require("./crawler");
const { inspectObject, delay } = require("../utils");

const { input, s3, withUi } = options;

// Unique Id for Folder to store files in...
const currentTs = Date.now();
const outputDir = path.resolve(__dirname, `../../output/step3/${currentTs}`);

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

		// debugLog(sourceImages);

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
		debugLog(`Auth URL: ${pauthUrl}`);

		// Go to the authorisation URL
		await page.goto(pauthUrl, { waitUntil: "domcontentloaded" });

		// Wait for the Profile Menu Item
		await page.waitForSelector(
			"#root > div > div.sc-dkYRiW.zAgBi > div > button.eRoEXR",
			{ timeout: 30000 }
		); // Wait for Profile "Secondary" Button

		// Set Filter Name
		const filterName = `Melody`;

		// Proceed with the Batch Image Processing
		const [filterCellElement] = await page.$x(
			`//div[contains(text(), '${filterName}')]`
		);

		const waitForPaint = () =>
			interval(
				async (i, doneInterval) => {
					try {
						debugLog(`Waiting for image paint - second ${i}`);
						await page.waitForSelector(
							"#root > div > div.sc-cjrQaZ.bkqtbz > div > div.sc-gXRoDt.sc-fydGIT.kjAuoY.dUrBNr > div > div > div.sc-kTLnJg.dYLStF > div",
							{ timeout: 1000, visible: true }
						);
					} catch (e) {
						debugLog(`Image painted`);
						doneInterval();
					}
				},
				1100,
				{ iterations: 60 }
			);

		const waitForUpload = () =>
			interval(
				async (i, doneInterval) => {
					try {
						debugLog(`Waiting for upload image - second ${i}`);
						await page.waitForSelector(
							"#root > div > div.sc-cjrQaZ.bkqtbz > div > div.sc-gXRoDt.sc-fydGIT.kjAuoY.dUrBNr > div > div.sc-jtXFOG.hSrftO",
							{ timeout: 1000, visible: true }
						);
					} catch (e) {
						debugLog(`Image uploaded`);
						doneInterval();
					}
				},
				1100,
				{ iterations: 60 }
			);

		// Click on Filter Cell -- ie. Melody
		await filterCellElement.click();
		// Wait for paint/filter process
		await waitForPaint();
		//* This process will add a default image to the App so that the ImageUploadElement can be found correctly

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
					await waitForUpload();
					// Click on Filter Cell -- ie. Melody
					await filterCellElement.click();
					// Wait for paint/filter process
					await waitForPaint();
					// Download the painted image to the output dir -- https://www.scrapingbee.com/blog/download-file-puppeteer/
					await page.click(
						"#root > div > div.sc-cjrQaZ.bkqtbz > div > div.sc-gXRoDt.sc-fydGIT.kjAuoY.dUrBNr > div > div > div.sc-iFMAoI.dnQAZn > div.sc-iqVVwt.dWaGix > button"
					);

					// Rename the file.
					await delay(500);
					const filename = path.basename(image);
					const filenamePieces = filename.split(".");
					// const filenameExt =
					filenamePieces.pop();
					const filenameNoExt = filenamePieces.join(".");
					const resultFile = path.join(
						outputDir,
						`${filenameNoExt}_prisma_${filterName.toLowerCase()}.jpg`
					);
					const newFile = path.join(outputDir, `${filenameNoExt}.jpg`);
					await ncp(resultFile, newFile);
					await del(resultFile);

					return { source: image, result: newFile };
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
			console.log(
				chalk.green(`[${taskId}] Successfully painted image`),
				result
			);
		});

		await new Promise((resolve) => {
			q.on("drain", () => {
				resolve();
			});
		});

		await page.close();
		await browser.close();

		await fs.writeFile(
			path.join(outputDir, "info.json"),
			JSON.stringify({
				script: "paint",
				ts: currentTs,
				source: input,
				output: outputDir,
				count: sourceImages.length
			})
		);

		console.log(chalk.green(`All done!`));
	})();
}

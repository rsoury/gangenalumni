/**
 * Step 1
 *
 * Generate the Human Avatars using GAN
 */

const path = require("path");
const axios = require("axios");
const axiosRetry = require("axios-retry");
const { S3 } = require("aws-sdk");
const Queue = require("better-queue");
const fs = require("fs");
const UserAgent = require("user-agents");
const chalk = require("chalk");
const ono = require("ono");
const mkdirp = require("mkdirp");
const debugLog = require("debug")("avatar-generate");

const options = require("../utils/options")((program) => {
	program.option("-n, --number <value>", "The number of images to generate.");
	program.option("--offset <value>", "The image number offset.");
});

const { s3 } = options;
const number = parseInt(options.number || 0, 10);
const offset = parseInt(options.offset || 0, 10);

// Unique Id for Folder to store files in...
const currentTs = Date.now();
const outputDir = path.resolve(__dirname, `../../output/step1/${currentTs}`);

debugLog(`Output Directory: ${outputDir}`);

const s3Split = s3.replace("s3://", "").split("/");
const s3BucketName = s3Split.shift();
const s3BucketKey = s3Split.join("/");
const s3Client = new S3({ params: { Bucket: s3BucketName } });

const request = axios.create();

axiosRetry(request, {
	retries: 3
});

if (!s3) {
	// Create dir
	mkdirp.sync(outputDir);
}

const q = new Queue(
	(id, done) => {
		const ua = new UserAgent();
		const userAgent = ua.toString();
		request
			.get(`https://thispersondoesnotexist.com/image`, {
				timeout: 30000,
				responseType: "arraybuffer",
				headers: {
					"User-Agent": userAgent
				}
			})
			.then((response) =>
				Buffer.from(response.data, "binary").toString("base64")
			)
			.then((base64) => {
				if (s3) {
					// .. hello s3
					return s3Client.putObject(
						{
							Key: path.join(s3BucketKey, `${currentTs}`, `${id}.jpeg`),
							Body: base64,
							ContentEncoding: "base64",
							ContentType: "image/jpeg"
						},
						(err) => {
							if (err) {
								return done(
									ono(err, {
										id
									})
								);
							}
							return done(null, { id });
						}
					);
				}

				return fs.writeFile(
					path.resolve(outputDir, `${id}.jpeg`),
					base64,
					"base64",
					(err) => {
						if (err) {
							return done(ono(err, { id }));
						}
						return done(null, { id });
					}
				);
			})
			.catch((err) => {
				done(
					ono(err, {
						id
					})
				);
			});
	},
	{
		batchDelay: 1000,
		retryDelay: 1000,
		maxRetries: 3
	}
);

q.on("task_failed", (taskId, err) => {
	console.log(chalk.red(`[${taskId}] failed to generate avatar`));
	console.error(err);
});

q.on("task_finish", (taskId, result) => {
	console.log(
		chalk.green(`[${taskId}] successfully generated avatar: ${result.id}`)
	);
});

q.on("drain", () => {
	console.log(chalk.cyan(`All done!`));
});

for (let i = offset + 1; i < number + 1; i += 1) {
	q.push(i);
}

(async () => {
	await fs.promises.writeFile(
		path.join(outputDir, "info.json"),
		JSON.stringify({
			script: "filter",
			ts: currentTs,
			output: outputDir,
			count: number
		})
	);
})();

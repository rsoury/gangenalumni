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

const options = require("./options");

const { number, s3 } = options;

const ua = new UserAgent();
const userAgent = ua.toString();

// Unique Id for Folder to store files in...
const currentTs = Date.now();
const outputDir = path.resolve(__dirname, "../../output");

const s3Split = s3.replace("s3://", "").split("/");
const s3BucketName = s3Split.shift();
const s3BucketKey = s3Split.join("/");
const s3Client = new S3({ params: { Bucket: s3BucketName } });

const request = axios.create({
	baseURL: `https://thispersondoesnotexist.com/image`,
	timeout: 30000,
	headers: {
		"User-Agent": userAgent
	}
});

axiosRetry(request, {
	retries: 3
});

if (!s3) {
	// Create dir
	mkdirp.sync(path.resolve(outputDir, `${currentTs}`));
}

const q = new Queue(
	(id, done) => {
		request
			.get("", {
				responseType: "arraybuffer"
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
					path.resolve(outputDir, `${currentTs}`, `${id}.jpeg`),
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
		batchDelay: 1000
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

for (let i = 1; i < number + 1; i += 1) {
	q.push(i);
}

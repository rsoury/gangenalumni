require("dotenv").config();

const path = require("path");
const fs = require("fs").promises;
const { default: readline } = require("readline-promise");
const { google } = require("googleapis");
const mkdirp = require("mkdirp");
const envalid = require("envalid");
const _ = require("lodash");
const interval = require("interval-promise");
const debugLog = require("debug")("avatar-paint");
const cheerio = require("cheerio");

const { inspectObject } = require("../utils");

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_DIR = path.resolve(__dirname, "../../tmp");
const TOKEN_PATH = path.join(TOKEN_DIR, "token.json");

const credentials = envalid.cleanEnv(process.env, {
	GOOGLE_CLIENT_ID: envalid.str(),
	GOOGLE_SECRET_KEY: envalid.str(),
	GOOGLE_REDIRECT_URIS: envalid.json()
});

mkdirp.sync(TOKEN_DIR);

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 */
async function getNewToken(oAuth2Client) {
	const authUrl = oAuth2Client.generateAuthUrl({
		access_type: "offline",
		scope: SCOPES
	});
	console.log("Authorize this app by visiting this url:", authUrl);
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: true
	});
	const code = await rl.questionAsync("Enter the code from that page here: ");
	rl.close();

	try {
		const token = await new Promise((resolve, reject) => {
			oAuth2Client.getToken(code, (err, t) => {
				if (err) {
					return reject(err);
				}
				return resolve(t);
			});
		});
		oAuth2Client.setCredentials(token);
		// Store the token to disk for later program executions
		await fs.writeFile(TOKEN_PATH, JSON.stringify(token));
		console.log("Token stored to", TOKEN_PATH);
		return oAuth2Client;
	} catch (err) {
		return console.error("Error retrieving access token", err);
	}
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 */
async function authorize() {
	const oAuth2Client = new google.auth.OAuth2(
		credentials.GOOGLE_CLIENT_ID,
		credentials.GOOGLE_SECRET_KEY,
		credentials.GOOGLE_REDIRECT_URIS[0]
	);

	// Check if we have previously stored a token.
	try {
		const token = await fs.readFile(TOKEN_PATH);
		oAuth2Client.setCredentials(JSON.parse(token));
		return oAuth2Client;
	} catch (err) {
		return getNewToken(oAuth2Client);
	}
}

/**
 * Fetch labels, and then isolate the email related to prisma auth.
 *
 * @param   {Object}  auth  Google Auth
 * @param   {Number}  offsetTs  Use offsetTime to ensure email comes after the login was executed.
 *
 * @return  {string}        Auth URL.
 */
async function fetchPrismaAuth(auth, offsetTs) {
	const gmail = google.gmail({ version: "v1", auth });
	const getLatestMessage = async () => {
		const response = await gmail.users.messages.list({
			userId: "me",
			maxResults: 1,
			labelIds: "INBOX",
			q: "from:noreply@prisma-ai.com subject:(Your Prisma verification code)"
		});
		return _.get(response, "data.messages[0]", {});
	};

	let message = await getLatestMessage();
	if (!_.isEmpty(message)) {
		message = await gmail.users.messages.get({
			userId: "me",
			id: message.id
		});
	}
	debugLog("immediate response");
	debugLog(inspectObject(message));
	if (!_.isEmpty(message)) {
		const messageTs = parseInt(message.data.internalDate, 10);
		if (messageTs < offsetTs && offsetTs > 0) {
			// Because the message timestamp is less than the offset timestamp, we're going to wait and listen for an incoming email.
			await interval(
				async (i, done) => {
					debugLog(`Iteration ${i} ...`);
					const newMessage = await getLatestMessage();
					// Use response to check if it's the same message, otherwise check ts again.
					if (!_.isEmpty(newMessage.id)) {
						if (newMessage.id !== message.id) {
							message = await gmail.users.messages.get({
								userId: "me",
								id: newMessage.id
							});
							debugLog(`Iteration ${i} is a catch!`);
							done();
						}
					}
				},
				5000,
				{ iterations: 60 }
			);

			debugLog("response after iterations");
			debugLog(inspectObject(message));
		}
	}

	if (_.isEmpty(message)) {
		debugLog("no message response found");
		return "";
	}

	// Mark message as read
	await gmail.users.messages.modify({
		userId: "me",
		id: message.data.id,
		removeLabelIds: ["UNREAD"]
	});

	// Process the message to extract the auth link
	// 1. Base64 Decode the Body
	// 2. Use Cheerio to extract the hyperlink in the auth button
	const bodyData = _.get(message, "data.payload.parts[1].body.data", "");
	const bodyHTML = Buffer.from(bodyData, "base64").toString("ascii");
	const $ = cheerio.load(bodyHTML);
	const authLink = $("a#button").attr("href");

	if (!_.isEmpty(authLink)) {
		return authLink;
	}

	return "";
}

module.exports = {
	authorize,
	fetchPrismaAuth
};

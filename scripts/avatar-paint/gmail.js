require("dotenv").config();

const path = require("path");
const fs = require("fs").promises;
const readline = require("readline-promise");
const { google } = require("googleapis");
const mkdirp = require("mkdirp");
const envalid = require("envalid");

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
		output: process.stdout
	});
	const code = await rl.question("Enter the code from that page here: ");
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
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listLabels(auth) {
	const gmail = google.gmail({ version: "v1", auth });
	gmail.users.labels.list(
		{
			userId: "me"
		},
		(err, res) => {
			if (err) {
				return console.log("The API returned an error: " + err);
			}
			const { labels } = res.data;
			if (labels.length) {
				console.log("Labels:");
				labels.forEach((label) => {
					console.log(`- ${label.name}`);
				});
			} else {
				console.log("No labels found.");
			}

			return null;
		}
	);
}

async function fetchPrismaCode() {
	// Authorize a client with credentials, then call the Gmail API.
	const auth = await authorize();

	return listLabels(auth);
}

module.exports = fetchPrismaCode;

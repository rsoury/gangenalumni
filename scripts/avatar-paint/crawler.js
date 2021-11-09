const vanillaPuppeteer = require("puppeteer");
const { addExtra } = require("puppeteer-extra");
const Adblocker = require("puppeteer-extra-plugin-adblocker");
const Stealth = require("puppeteer-extra-plugin-stealth");
const AnonymizeUA = require("puppeteer-extra-plugin-anonymize-ua");
const UserDataDir = require("puppeteer-extra-plugin-user-data-dir");
const UserAgent = require("user-agents");

// Setup puppeteer plugins
const puppeteer = addExtra(vanillaPuppeteer);
puppeteer.use(Adblocker());
puppeteer.use(Stealth());
puppeteer.use(
	AnonymizeUA({
		makeWindows: false,
		stripHeadless: false,
		customFn() {
			const ua = new UserAgent();
			return ua.toString();
		}
	})
);
puppeteer.use(UserDataDir()); // Manages temp store and clean at launch/close for user data dir.

module.exports = puppeteer;

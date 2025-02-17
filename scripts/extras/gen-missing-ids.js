/**
 * Script to produce an array of ids missing from a directory.
 */

require("dotenv").config();
const path = require("path");
const chalk = require("chalk");
const mkdirp = require("mkdirp");
const jsonfile = require("jsonfile");
const options = require("../utils/options")((program) => {
	program.option("-o, --output <value>", "A path to an output directory.");
});
const { getImages, getName } = require("../utils");

console.log(chalk.yellow(`Starting beard detection ...`));

// The input directory of images is the Exported images.
// The compare directory of images is the original/imported/pre-enhanced images.
const { input } = options;
const outputDir = options.output || process.cwd();
mkdirp.sync(outputDir);

(async () => {
	const sourceImages = await getImages(input);
	console.log(chalk.yellow(`Images and data obtained ...`));

	const missingIds = [];
	const foundIds = sourceImages.map((imgPath) =>
		parseInt(getName(imgPath), 10)
	);
	for (let i = 1; i <= 10000; i += 1) {
		if (!foundIds.includes(i)) {
			missingIds.push(i);
		}
	}

	await jsonfile.writeFile(
		path.join(outputDir, `missing-tokens.json`),
		missingIds
	);

	console.log(
		chalk.green(
			`All done! ${missingIds.length} missing ids, ${
				foundIds.length
			} found ids, ${missingIds.length + foundIds.length} in total`
		)
	);
})();

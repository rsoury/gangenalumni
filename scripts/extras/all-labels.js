/**
 * Script to rename enhanced exported images to their distance to the compared images where index.json resides.
 * Designed for Beard enhancements only.
 */

require("dotenv").config();
const path = require("path");
const chalk = require("chalk");
const mkdirp = require("mkdirp");
const jsonfile = require("jsonfile");
const glob = require("glob-promise");
const _ = require("lodash");
const options = require("../utils/options")((program) => {
	program.option("-o, --output <value>", "A path to an output directory.");
});

console.log(chalk.yellow(`Starting label aggregation ...`));

// The input directory of images is the Exported images.
// The compare directory of images is the original/imported/pre-enhanced images.
const { input } = options;
const outputDir = options.output || process.cwd();
mkdirp.sync(outputDir);

(async () => {
	const labelsOutputFile = path.join(outputDir, "all-labels.json");
	const objectsOutputFile = path.join(outputDir, "all-objects.json");
	const labelDataFiles = await glob(path.join(input, "*.json"));
	const allLabels = [];
	const allObjects = [];

	for (let i = 0; i < labelDataFiles.length; i += 1) {
		const { labels, objects } = await jsonfile.readFile(labelDataFiles[i]);
		labels.forEach(({ description }) => {
			allLabels.push(description);
		});
		objects.forEach(({ name }) => {
			allObjects.push(name);
		});
	}

	const aggLabels = _.uniq(allLabels);
	const aggObjects = _.uniq(allObjects);
	await jsonfile.writeFile(labelsOutputFile, aggLabels);
	await jsonfile.writeFile(objectsOutputFile, aggObjects);

	console.log(chalk.green(`All done!`));
	console.log(
		`${allLabels.length} labels aggregated down to ${aggLabels.length} and stored at ${labelsOutputFile}`
	);
	console.log(
		`${allObjects.length} objects aggregated down to ${aggObjects.length} and stored at ${objectsOutputFile}`
	);
})();

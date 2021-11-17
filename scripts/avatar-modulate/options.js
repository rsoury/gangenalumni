/**
 * A Node.js script to parse input images through face filters
 */

const { Command } = require("commander");

const program = new Command();

program.option(
	"-s, --s3 <value>",
	"Bucket and location to use to store avatars in s3."
);
program.option(
	"-i, --input <value>",
	"The image or directory of images to use as an input"
);

program.parse(process.argv);

const options = program.opts();

module.exports = {
	...options,
	s3: options.s3 || "",
	input: options.input || ""
};

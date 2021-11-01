/**
 * A Node.js script to fetch GAN Human images and then either save locally or save in S3.
 */

const isNumeric = require("is-numeric");
const { Command } = require("commander");

const program = new Command();

program.option(
	"-s, --s3 <value>",
	"Bucket and location to use to store avatars in s3."
);
program.option("-n, --number <value>", "The number of avatars to generate.");

program.parse(process.argv);

const options = program.opts();

module.exports = {
	...options,
	s3: options.s3 || "",
	number: isNumeric(options.number) ? parseInt(options.number, 10) : 0
};

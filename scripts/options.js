const { Command } = require("commander");

const program = new Command();

const getOptions = (features = []) => {
	program.option(
		"-s, --s3 <value>",
		"Bucket and location to use to store avatars in s3."
	);
	program.option(
		"-i, --input <value>",
		"The image or directory of images to use as an input"
	);

	if (features.includes("browser")) {
		program.option(
			"-w, --with-ui",
			"Option to show the browser during automation. Browser will run headlessly by default."
		);
	}

	program.parse(process.argv);

	const options = program.opts();

	return {
		...options,
		s3: options.s3 || "",
		input: options.input || ""
	};
};

module.exports = getOptions;

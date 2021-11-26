const getPixelsFn = require("get-pixels");

const getPixels = (imagePath) =>
	new Promise((resolve, reject) => {
		getPixelsFn(imagePath, (err, pixels) => {
			if (err) {
				return reject(err);
			}
			return resolve(pixels);
		});
	});

module.exports = getPixels;

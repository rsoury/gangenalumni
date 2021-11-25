/**
 * This is a helper function that will apply the indicator markers on every landmark
 *
 * Returns the Sharp composite settings input to be merged
 */

const _ = require("lodash");
const sizeOf = require("image-size");
const randomColor = require("randomcolor");
const debugLog = require("debug")("avatar-accessorise");

const indicateLandmarks = async (image, awsFacialData) => {
	const dimensions = await sizeOf(image);
	const facialLandmarks = _.get(awsFacialData, "FaceDetails[0].Landmarks", []);

	return facialLandmarks.map((landmark) => {
		const color = randomColor({ luminosity: "light" });

		debugLog({ type: landmark.Type, color });

		return {
			// input: indicatorBuffer,
			input: {
				create: {
					width: 10,
					height: 10,
					channels: 3,
					background: color
				}
			},
			// raw: {
			// 	width,
			// 	height,
			// 	channels: 3
			// },
			gravity: "centre", // Seems to be the approach at placing the image -- which is to use it's "centre"
			left: Math.round(dimensions.width * landmark.X), // Math.round(dimensions.width * landmark.X - indicatorRadius),
			top: Math.round(dimensions.height * landmark.Y) // Math.round(dimensions.height * landmark.Y - indicatorRadius)
		};
	});
};

module.exports = indicateLandmarks;

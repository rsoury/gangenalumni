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
			input: {
				create: {
					width: 10,
					height: 10,
					channels: 3,
					background: color
				}
			},
			left: Math.round(dimensions.width * landmark.X - 5),
			top: Math.round(dimensions.height * landmark.Y - 5),
			blend: "add"
		};
	});
};

module.exports = indicateLandmarks;

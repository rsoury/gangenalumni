/**
 * This is a helper function that will apply the indicator markers on every landmark
 *
 * Returns the Sharp composite settings input to be merged
 */

// const path = require("path");
const _ = require("lodash");
const sizeOf = require("image-size");
// const Canvas = require("canvas");
const randomColor = require("randomcolor");
const debugLog = require("debug")("avatar-accessorise");

// const indicatorRadius = 15;

/**
 * Resources:
 * https://stackoverflow.com/questions/8549725/different-fillstyle-colors-for-arc-in-canvas
 * https://www.codegrepper.com/code-examples/javascript/draw+circles+node.js+canvas
 * https://stackoverflow.com/questions/9548074/nodejs-how-to-add-image-data-from-file-into-canvas
 */

const indicateLandmarks = async (image, awsFacialData) => {
	const dimensions = await sizeOf(image);
	const facialLandmarks = _.get(awsFacialData, "FaceDetails[0].Landmarks", []);

	const indicator = facialLandmarks
		.map((landmark) => {
			const color = randomColor({ luminosity: "light" });
			// const canvas = new Canvas(indicatorRadius * 2, indicatorRadius * 2);
			// const ctx = canvas.getContext("2d");
			// ctx.beginPath();
			// ctx.arc(
			// 	indicatorRadius,
			// 	indicatorRadius,
			// 	indicatorRadius,
			// 	0,
			// 	2 * Math.PI,
			// 	true
			// );
			// ctx.closePath();
			// ctx.fillStyle = color;
			// ctx.fill();

			return {
				color,
				type: landmark.Type,
				input: {
					width: 20,
					height: 20,
					background: color
				},
				left: dimensions.width * landmark.X - 10,
				top: dimensions.height * landmark.Y - 10
			};
		})
		.reduce(
			(obj, currentValue) => {
				const { color, type, ...settings } = currentValue;
				obj.colors[type] = color;
				obj.settings.push(settings);
				return obj;
			},
			{
				colors: {},
				settings: []
			}
		);

	debugLog({ colors: indicator.colors });

	return indicator.settings;
};

module.exports = indicateLandmarks;

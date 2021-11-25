/**
 * This is a helper function that will apply the indicator markers on every landmark
 *
 * Returns the Sharp composite settings input to be merged
 */

// const path = require("path");
const _ = require("lodash");
const sizeOf = require("image-size");
const { createCanvas } = require("canvas");
const randomColor = require("randomcolor");
const debugLog = require("debug")("avatar-accessorise");

const indicatorRadius = 15;

/**
 * Resources:
 * https://stackoverflow.com/questions/8549725/different-fillstyle-colors-for-arc-in-canvas
 * https://www.codegrepper.com/code-examples/javascript/draw+circles+node.js+canvas
 * https://stackoverflow.com/questions/9548074/nodejs-how-to-add-image-data-from-file-into-canvas
 */

const indicateLandmarks = async (image, awsFacialData) => {
	const dimensions = await sizeOf(image);
	const facialLandmarks = _.get(awsFacialData, "FaceDetails[0].Landmarks", []);

	return facialLandmarks.map((landmark) => {
		const color = randomColor({ luminosity: "light" });
		// const width = indicatorRadius * 2; // + 200;
		// const height = indicatorRadius * 2;
		// const canvas = createCanvas(width, height);
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
		// // ctx.font = "12px Impact";
		// // ctx.fillText(
		// // 	landmark.Type,
		// // 	indicatorRadius * 2 + 10,
		// // 	0,
		// // 	190 - indicatorRadius * 2
		// // );
		// ctx.fillStyle = color;
		// ctx.fill();

		// const indicatorBase64 = canvas.toDataURL("image/png");
		// const indicatorBuffer = Buffer.from(indicatorBase64, "base64");

		// debugLog({ type: landmark.Type, color, indicatorBase64, indicatorBuffer });

		return {
			// input: indicatorBuffer,
			input: {
				create: {
					width: 20,
					height: 20,
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

const _ = require("lodash");
const sizeOf = require("image-size");

const getCoords = async (image, awsFacialData) => {
	const dimensions = await sizeOf(image);
	const facialLandmarks = _.get(awsFacialData, "FaceDetails[0].Landmarks", []);

	return {
		forMouth() {
			// Then get the mouth landmark to determine the coordinates
			const mouthBottomLandmark = facialLandmarks.find(
				({ Type: type }) => type === "mouthDown"
			);
			if (_.isEmpty(mouthBottomLandmark)) {
				throw new Error(
					`Cannot find the mouthDown Landmark for image ${image}`
				);
			}
			const mouthTopLandmark = facialLandmarks.find(
				({ Type: type }) => type === "mouthUp"
			);
			if (_.isEmpty(mouthTopLandmark)) {
				throw new Error(`Cannot find the mouthUp Landmark for image ${image}`);
			}
			const mouthBottomCoords = {
				x: mouthBottomLandmark.X * dimensions.width,
				y: mouthBottomLandmark.Y * dimensions.height
			};
			const mouthTopCoords = {
				x: mouthTopLandmark.X * dimensions.width,
				y: mouthTopLandmark.Y * dimensions.height
			};
			// Deduce center of mouth coords -- or just below the top of the mouth
			const mouthCoords = {
				x:
					mouthTopCoords.x + ((mouthBottomCoords.x - mouthTopCoords.x) / 8) * 5,
				y: mouthTopCoords.y + ((mouthBottomCoords.y - mouthTopCoords.y) / 8) * 5
			};

			return mouthCoords;
		},
		forNose() {
			// Then get the mouth landmark to determine the coordinates
			const noseLandmark = facialLandmarks.find(
				({ Type: type }) => type === "nose"
			);
			if (_.isEmpty(noseLandmark)) {
				throw new Error(`Cannot find the Nose Landmark for image ${image}`);
			}
			const noseTipCoords = {
				x: noseLandmark.X * dimensions.width,
				y: noseLandmark.Y * dimensions.height
			};

			// // Deduce nose bridge coords by referring to the X coordinates of the facial eyes.
			return noseTipCoords;
		},
		forGlabella() {
			// Get the center of the leftEyeBrowRight and rightEyeBrowLeft
			const leftLandmark = facialLandmarks.find(
				({ Type: type }) => type === "leftEyeBrowRight"
			);
			if (_.isEmpty(leftLandmark)) {
				throw new Error(
					`Cannot find the leftEyeBrowRight Landmark for image ${image}`
				);
			}
			const rightLandmark = facialLandmarks.find(
				({ Type: type }) => type === "rightEyeBrowLeft"
			);
			if (_.isEmpty(rightLandmark)) {
				throw new Error(
					`Cannot find the rightEyeBrowLeft Landmark for image ${image}`
				);
			}
			const leftCoords = {
				x: leftLandmark.X * dimensions.width,
				y: leftLandmark.Y * dimensions.height
			};
			const rightCoords = {
				x: rightLandmark.X * dimensions.width,
				y: rightLandmark.Y * dimensions.height
			};
			// Deduce center of two coords
			let { y } = leftCoords;
			if (leftCoords.y < rightCoords.y) {
				y = leftCoords.y + (rightCoords.y - leftCoords.y) / 2;
			} else if (leftCoords.y > rightCoords.y) {
				y = rightCoords.y + (leftCoords.y - rightCoords.y) / 2;
			}
			const coords = {
				x: leftCoords.x + (rightCoords.x - leftCoords.x) / 2,
				y
			};

			return coords;
		},
		forEyeRight() {
			// Get coords of the bottom & center of the right eye
			const landmark = facialLandmarks.find(
				({ Type: type }) => type === "rightEyeDown"
			);
			if (_.isEmpty(landmark)) {
				throw new Error(
					`Cannot find the rightEyeDown Landmark for image ${image}`
				);
			}
			const coords = {
				x: landmark.X * dimensions.width,
				y: landmark.Y * dimensions.height
			};

			return coords;
		},
		forEyeLeft() {
			// Get coords of the bottom & center of the left eye
			const landmark = facialLandmarks.find(
				({ Type: type }) => type === "leftEyeDown"
			);
			if (_.isEmpty(landmark)) {
				throw new Error(
					`Cannot find the leftEyeDown Landmark for image ${image}`
				);
			}
			const coords = {
				x: landmark.X * dimensions.width,
				y: landmark.Y * dimensions.height
			};

			return coords;
		},
		forChinRight() {
			// Use midJawlineRight to determine the coords
			const landmark = facialLandmarks.find(
				({ Type: type }) => type === "midJawlineRight"
			);
			if (_.isEmpty(landmark)) {
				throw new Error(
					`Cannot find the midJawlineRight Landmark for image ${image}`
				);
			}
			const coords = {
				x: landmark.X * dimensions.width,
				y: landmark.Y * dimensions.height
			};

			return coords;
		},
		forChinLeft() {
			// Use midJawlineLeft to determine the coords
			const landmark = facialLandmarks.find(
				({ Type: type }) => type === "midJawlineLeft"
			);
			if (_.isEmpty(landmark)) {
				throw new Error(
					`Cannot find the midJawlineLeft Landmark for image ${image}`
				);
			}
			const coords = {
				x: landmark.X * dimensions.width,
				y: landmark.Y * dimensions.height
			};

			return coords;
		},
		forForeheadRight() {
			// Use the rightEyeBrowRight landmark to determine the furthest right part of the face
			// Then use the bottom of the image as the entry point.
			// Add a buffer/padding to move the image above the eyebrow and inward.

			const landmark = facialLandmarks.find(
				({ Type: type }) => type === "rightEyeBrowRight"
			);
			if (_.isEmpty(landmark)) {
				throw new Error(
					`Cannot find the rightEyeBrowRight Landmark for image ${image}`
				);
			}
			const coords = {
				x: landmark.X * dimensions.width,
				y: landmark.Y * dimensions.height
			};

			return coords;
		},
		forForeheadLeft() {
			return {};
		},
		forNeckRight() {
			return {};
		},
		forNeckLeft() {
			return {};
		}
	};
};

module.exports = getCoords;

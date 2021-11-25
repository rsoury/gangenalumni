const _ = require("lodash");
const sizeOf = require("image-size");

const getCoords = async (image, awsFacialData) => {
	const dimensions = await sizeOf(image);
	const facialLandmarks = _.get(awsFacialData, "FaceDetails[0].Landmarks", []);

	const getLandmark = (t) => {
		const landmark = facialLandmarks.find(({ Type: type }) => type === t);
		if (_.isEmpty(landmark)) {
			throw new Error(`Cannot find the ${t} Landmark for image ${image}`);
		}
		return landmark;
	};

	return {
		forMouth() {
			// Then get the mouth landmark to determine the coordinates
			const mouthBottomLandmark = getLandmark("mouthDown");
			const mouthTopLandmark = getLandmark("mouthUp");
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
			const noseLandmark = getLandmark("nose");
			const noseTipCoords = {
				x: noseLandmark.X * dimensions.width,
				y: noseLandmark.Y * dimensions.height
			};

			return noseTipCoords;
		},
		forGlabella() {
			// Get the center of the first points leftEyeBrowRight, rightEyeBrowLeft, eyeRight, eyeLeft
			const browLeftLandmark = getLandmark("leftEyeBrowRight");
			const browRightLandmark = getLandmark("rightEyeBrowLeft");
			const eyeLeftLandmark = getLandmark("eyeLeft");
			const eyeRightLandmark = getLandmark("eyeRight");

			const leftLandmark = {
				Y: eyeLeftLandmark.Y + (browLeftLandmark.Y - eyeLeftLandmark.Y) / 2,
				X: eyeLeftLandmark.X + (browLeftLandmark.X - eyeLeftLandmark.X) / 2
			};
			const rightLandmark = {
				Y: eyeRightLandmark.Y + (browRightLandmark.Y - eyeRightLandmark.Y) / 2,
				X: eyeRightLandmark.X + (browRightLandmark.X - eyeRightLandmark.X) / 2
			};

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
			const { Y } = getLandmark("rightEyeDown");
			const { X } = getLandmark("rightEyeRight");
			const landmark = {
				X,
				Y
			};

			const coords = {
				x: landmark.X * dimensions.width,
				y: landmark.Y * dimensions.height + 40
			};

			return coords;
		},
		forEyeLeft() {
			// Get coords of the bottom & center of the left eye
			// Add a buffer because of large eyes
			const { Y } = getLandmark("leftEyeDown");
			const { X } = getLandmark("leftEyeLeft");
			const landmark = {
				X,
				Y
			};

			const coords = {
				x: landmark.X * dimensions.width,
				y: landmark.Y * dimensions.height + 40
			};

			return coords;
		},
		forChinRight() {
			// Use the center between midJawlineRight, mouthRight to determine the coords
			const jawlineLandmark = getLandmark("midJawlineRight");
			const mouthLandmark = getLandmark("mouthRight");

			const landmark = {
				X: jawlineLandmark.X + (mouthLandmark.X - jawlineLandmark.X) / 2,
				Y: jawlineLandmark.Y + (mouthLandmark.Y - jawlineLandmark.Y) / 2
			};

			const coords = {
				x: landmark.X * dimensions.width,
				y: landmark.Y * dimensions.height
			};

			return coords;
		},
		forChinLeft() {
			// Use the center between midJawlineLeft, mouthLeft to determine the coords
			const jawlineLandmark = getLandmark("midJawlineLeft");
			const mouthLandmark = getLandmark("mouthLeft");

			const landmark = {
				X: jawlineLandmark.X + ((mouthLandmark.X - jawlineLandmark.X) / 8) * 5,
				Y: jawlineLandmark.Y + ((mouthLandmark.Y - jawlineLandmark.Y) / 8) * 5
			};

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

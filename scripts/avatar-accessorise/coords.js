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
					`Cannot find the Mouth Bottom Landmark for image ${image}`
				);
			}
			const mouthTopLandmark = facialLandmarks.find(
				({ Type: type }) => type === "mouthUp"
			);
			if (_.isEmpty(mouthTopLandmark)) {
				throw new Error(
					`Cannot find the Mouth Top Landmark for image ${image}`
				);
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
		forNose() {},
		forGlabella() {},
		forEyeRight() {},
		forEyeLeft() {},
		forChinRight() {},
		forChinLeft() {},
		forForeheadRight() {},
		forForeheadLeft() {},
		forNeckRight() {},
		forNeckLeft() {}
	};
};

module.exports = getCoords;

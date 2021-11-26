const _ = require("lodash");
const sizeOf = require("image-size");

const checkLocationAvailability = async (
	image,
	referencePigmentColor,
	compositeImage,
	compositeCoords
) => {
	const yaw = _.get(awsFacialData, "FaceDetails[0].Pose.Yaw");
	if (_.isUndefined(yaw)) {
		throw new Error(
			`Cannot find the Yaw for image ${image} in locationAvailable`
		);
	}
	const isFacingLeft = yaw < 0;
	const facialLandmarks = _.get(awsFacialData, "FaceDetails[0].Landmarks", []);
	const { X } =
		facialLandmarks.find(({ Type: type }) =>
			type === isFacingLeft ? "noseLeft" : "noseRight"
		) || {};
	const { Y } = facialLandmarks.find(({ Type: type }) => type === "nose") || {};
	if (_.isUndefined(X) || _.isUndefined(Y)) {
		throw new Error(
			`Cannot find the Pigment Landmark Values for image ${image}`
		);
	}
	const landmark = {
		X,
		Y
	};

	const pixels = await getPixels(image);
};

module.exports = checkLocationAvailability;

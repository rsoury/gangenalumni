const util = require("util");

const delay = (timeout) =>
	new Promise((resolve) => {
		setTimeout(() => {
			resolve();
		}, timeout);
	});

module.exports.delay = delay;

module.exports.inspectObject = (o) => util.inspect(o, false, null, true);

// https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
function componentToHex(c) {
	const hex = c.toString(16);
	return hex.length === 1 ? "0" + hex : hex;
}
function rgbToHex(r, g, b) {
	return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

module.exports.rgbToHex = rgbToHex;

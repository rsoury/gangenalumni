const util = require("util");
const fs = require("fs").promises;
const glob = require("glob-promise");
const path = require("path");
const { ncp } = require("ncp");

const delay = (timeout) =>
	new Promise((resolve) => {
		setTimeout(() => {
			resolve();
		}, timeout);
	});

module.exports.delay = delay;

module.exports.inspectObject = (o) => util.inspect(o, false, null, true);

module.exports.stripTrailingSlash = (str) => {
	if (str.charAt(str.length - 1) === "/") {
		return str.substr(0, str.length - 1);
	}
	return str;
};

module.exports.getImages = async (input, extensions = "jpeg,jpg,png") => {
	let images = [];
	const stat = await fs.lstat(input);
	if (stat.isFile()) {
		// Use file as image
		images.push(path.resolve(input));
	} else {
		// Get images from directory
		images = await glob(`${input}/*.{${extensions}}`, {
			absolute: true
		});
	}

	return images;
};

module.exports.getName = (filePath) =>
	path.basename(filePath).split(".").slice(0, -1).join(".");

module.exports.copy = async (source, destination, options = {}) =>
	new Promise((resolve, reject) => {
		ncp(source, destination, options, (err) => {
			if (err) {
				return reject(err);
			}
			return resolve();
		});
	});

// https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
function componentToHex(c) {
	const hex = c.toString(16);
	return hex.length === 1 ? "0" + hex : hex;
}
function rgbToHex(r, g, b) {
	return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

module.exports.rgbToHex = rgbToHex;

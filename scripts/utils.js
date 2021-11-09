const util = require("util");

const delay = (timeout) =>
	new Promise((resolve) => {
		setTimeout(() => {
			resolve();
		}, timeout);
	});

module.exports.delay = delay;

module.exports.inspectObject = (o) => util.inspect(o, false, null, true);

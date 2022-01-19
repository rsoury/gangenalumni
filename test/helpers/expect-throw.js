const { assert } = require("chai");

const expectThrow = async (promise, expectedErrorMessage) => {
	try {
		await promise;
	} catch (error) {
		assert(
			error.message.search(expectedErrorMessage) >= 0,
			"Expected throw, got '" + error + "' instead"
		);
		return;
	}
	assert.fail("Expected throw not received");
};

module.exports = expectThrow;

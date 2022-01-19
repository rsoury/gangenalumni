const { assert } = require("chai");

const expectThrow = async (promise) => {
	try {
		await promise;
	} catch (error) {
		const invalidJump = error.message.search("invalid JUMP") >= 0;
		const outOfGas = error.message.search("out of gas") >= 0;
		const tokenIdOutOfBounds =
			error.message.search("token id out of bounds") >= 0;
		assert(
			invalidJump || outOfGas || tokenIdOutOfBounds,
			"Expected throw, got '" + error + "' instead"
		);
		return;
	}
	assert.fail("Expected throw not received");
};

module.exports = expectThrow;

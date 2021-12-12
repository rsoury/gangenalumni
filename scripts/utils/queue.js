/**
 * Extend better-queue to promisify the fn handler
 */

const BetterQueue = require("better-queue");

class Queue extends BetterQueue {
	constructor(handler, ...params) {
		super((handlerParams, done) => {
			return handler(handlerParams)
				.then((resp) => {
					done(null, resp);
				})
				.catch((err) => {
					done(err);
				});
		}, ...params);
	}
}

module.exports = Queue;

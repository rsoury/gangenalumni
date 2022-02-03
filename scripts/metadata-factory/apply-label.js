const _ = require("lodash");
const chalk = require("chalk");

const applyLabel = (resultLabels, label, settings) => {
	const labelSetting = settings.find(
		(setting) => setting.name === label.description
	);
	if (!_.isUndefined(labelSetting)) {
		if (label.score > labelSetting.score) {
			const existingLabel = resultLabels.find(
				({ setting }) =>
					setting.group === labelSetting.group && labelSetting.group > 0
			);
			if (_.isUndefined(existingLabel)) {
				resultLabels.push({
					label,
					setting: labelSetting
				});
			} else if (label.score > existingLabel.label.score) {
				// Check to see if the current label has a higher score than the label for this given group.
				// Get the index of the existing label
				const existingLabelIndex = resultLabels.findIndex(
					({ setting }) =>
						setting.group === labelSetting.group && labelSetting.group > 0
				);
				// Replace the existing label
				if (existingLabelIndex < 0) {
					console.log(
						chalk.red(`ERROR: existing label found but index not found`),
						resultLabels,
						label,
						existingLabel,
						existingLabelIndex
					);
				} else {
					resultLabels[existingLabelIndex] = {
						label,
						setting: labelSetting
					};
				}
			}
		}
	}
};

module.exports = applyLabel;

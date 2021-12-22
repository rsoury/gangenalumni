module.exports = {
	extends: [
		"airbnb-base",
		"plugin:prettier/recommended",
		"plugin:import/errors",
		"plugin:import/warnings"
	],
	settings: {
		"import/resolver": {
			alias: {
				extensions: [".js", ".json"]
			}
		}
	},
	env: {
		mocha: true
	},
	overrides: [
		{
			files: ["test/**/*"],
			globals: {
				ethers: "readonly"
			}
		},
		{
			files: ["hardhat.config.js"],
			globals: {
				task: "readonly"
			}
		}
	],
	rules: {
		// See: https://github.com/benmosher/eslint-plugin-import/issues/496
		"import/no-extraneous-dependencies": 0,
		"no-console": 0,
		"no-unused-vars": [
			"error",
			{ ignoreRestSiblings: true, varsIgnorePattern: "should|expect" }
		],
		"no-param-reassign": 0,
		"import/prefer-default-export": 0,
		"class-methods-use-this": 0,
		"prefer-template": 0,
		"no-extra-boolean-cast": 0,
		"no-underscore-dangle": 0,
		camelcase: 0,
		"no-multi-assign": 0,
		"no-await-in-loop": 0
	}
};

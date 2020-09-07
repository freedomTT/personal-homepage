module.exports = {
	root: true,
	parserOptions: {
		"ecmaVersion": 6,
		"sourceType": 'module'
	},
	env: {
		browser: true
	},
	rules: {
		"indent": [
			"error",
			2
		],
		"quotes": [
			"error",
			"double"
		],
		"semi": [
			"error",
			"always"
		],
		"no-console": "off",
		"arrow-parens": 0
	}
};

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

let config = {
	mode: process.env.NODE_ENV,
	entry: __dirname + '/src/main.js',
	output: {
		filename: 'bundle.js',
		path: path.resolve(__dirname, 'dist')
	},
	module: {
		rules: [
			{
				test: /\.css$/,
				use: [
					{loader: 'style-loader'},
					{
						loader: 'css-loader',
						options: {
							modules: true
						}
					},
					{
						loader: 'postcss-loader'
					}
				]
			},
			{
				test: /\.less$/,
				use: [
					{loader: 'style-loader'},
					{
						loader: 'css-loader',
						options: {
							modules: true
						}
					},
					{
						loader: 'postcss-loader'
					},
					{loader: 'less-loader'}
				]
			},
		]
	},
	plugins: [
		new HtmlWebpackPlugin({
			template: 'index.ejs',
			inject: true
		}),
		new CopyWebpackPlugin({
			patterns: [
				{
					from: path.resolve(__dirname, 'static'),
					to: 'static',
					globOptions: {
						ignore: ['.*']
					},
				}
			]
		})
	],
};

module.exports = (env, argv) => {
	if (argv.mode === 'development') {
		config.devtool = 'eval-source-map';
		config.devServer = {
			historyApiFallback: true,
			inline: true
		}
	}
	if (argv.mode === 'production') {

	}
	return config;
};

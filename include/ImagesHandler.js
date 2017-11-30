/*
 * Website generator v2 - ImagesHandler.js
 */

'use strict';

/**
 * Load module dependencies
 */
const gulp = require('gulp');
const plumber = require('gulp-plumber');
const imagemin = require('gulp-imagemin');
const lazypipe = require('lazypipe');
const Utils = require('./Utils');

/**
 * Module responsible for handling images
 */
class ImagesHandler {

	/**
	 * Constructor
	 *
	 * @param config
	 */
	constructor(config)
	{
		this.settings = config.settings;
		this.utils = new Utils(config);

		// check that the configuration is valid for this module
		config.onLoad(() =>
		{
			Utils.assert(this.settings.images, 'No configuration section for images.');
			Utils.assert(this.settings.images.input, 'No input filter for images.');

			// finalize configuration
			this.settings.images.input = this.utils.filterBuildPath(this.settings.images.input);
		});
	}

	/**
	 * Process images:
	 */
	process()
	{
		return gulp.src(this.settings.images.input)
			.pipe(plumber())
			.pipe(this.utils.runHooks('beforeImagesProcessing')())
			.pipe((this._pipeImages())())
			.pipe(this.utils.runHooks('afterImagesProcessing')())
			.pipe(gulp.dest(this.settings.buildPath));
	}

	/**
	 * A custom pipe that handles images.
	 *
	 * - image minification
	 *
	 * @private
	 */
	_pipeImages()
	{
		return lazypipe()
			.pipe(imagemin,
				[
					// FIXME make configurable in webgen.yaml? all lossless, so not really required.
					imagemin.gifsicle({
						interlaced: true,
						optimizationLevel: 3
					}),
					imagemin.jpegtran({
						progressive: true
					}),
					imagemin.optipng({
						optimizationLevel: 5
					}),
					imagemin.svgo({
						plugins: [{removeViewBox: true}]
					})
				],
				{
					verbose: true
				}
			);
	}

}

/**
 * module export
 * @type {ImagesHandler}
 */
module.exports = ImagesHandler;


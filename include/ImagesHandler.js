/*
 * Website generator v2 - ImagesHandler.js
 */

'use strict';

/**
 * Load module dependencies
 */
const gulp = require('gulp');
const imagemin = require('gulp-imagemin');
const pngquant = require('imagemin-pngquant');
const lazypipe = require('lazypipe');
const noop = require('gulp-util').noop;
const cache = require('gulp-cached');
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
			.pipe(cache('images'))
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
			.pipe(imagemin, {
				progressive: true,
				use: [pngquant()],
				optimizationLevel: 5,
				interlaced: true
			});
	}

}

/**
 * module export
 * @type {ImagesHandler}
 */
module.exports = ImagesHandler;


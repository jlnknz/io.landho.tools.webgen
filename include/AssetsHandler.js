/**
 * Website generator v2 - AssetsHandler.js
 *
 * NOTE: when watching, we do not support renaming or deleting of existing assets. Renaming will create a new file
 * but not delete the old one.
 */

'use strict';

/**
 * Load module dependencies
 */
const gulp = require('gulp');
const noop = require('gulp-util').noop;
const Utils = require('./Utils');
const cache = require('gulp-cached');

/**
 * Module responsible for handling assets (i.e. files that must be copied as-is)
 */
class AssetsHandler {

	/**
	 * constructor
	 *
	 * @param config
	 */
	constructor(config)
	{
		this.utils = new Utils(config);
		this.settings = config.settings;

		// check that the configuration is valid for this module
		config.onLoad(() =>
		{
			Utils.assert(this.settings.assets, 'No configuration section for assets.');
			Utils.assert(this.settings.assets.input, 'No input filter for assets.');

			// finalize configuration
			this.settings.assets.input = this.utils.filterBuildPath(this.settings.assets.input);
		});
	}

	/**
	 * Copy all assets to the destination path.
	 */
	copy()
	{
		return gulp.src(this.settings.assets.input)
			.pipe(cache('assets'))
			.pipe((this.utils.runHooks('beforeCopyAssets'))())
			.pipe(gulp.dest(this.settings.buildPath));
	}

}

/**
 * Module export.
 */
module.exports = AssetsHandler;

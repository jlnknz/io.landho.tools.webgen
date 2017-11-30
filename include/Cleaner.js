/**
 * Website generator v2 - Cleaner.js
 */

'use strict';

/**
 * Load module dependencies
 */
const del = require('del');
const Utils = require('./Utils');

/**
 * This class is responsible for cleaning application build data.
 */
class Cleaner {

	/**
	 * Constructor
	 */
	constructor(config)
	{
		this.settings = config.settings;
		this.utils = new Utils(config);

		// check that the configuration is valid for this module
		config.onLoad(() =>
		{
			Utils.assert(this.settings.buildDeleteOutsideOfConfigDir !== undefined, 'Unsafe deletion parameter is not set.');
			Utils.assert(
				this.settings.buildPath.indexOf(this.settings.root) === 0
				|| this.settings.buildDeleteOutsideOfConfigDir,
				'Cleaning cannot work as buildDeleteOutsideOfConfigDir is not true and the build path is outside of directory containing the configuration file'
			);
		});
	}

	/**
	 * Remove the target build directory.
	 */
	cleanBuildDir()
	{
		return this.utils.runHooks('beforeCleanBuildDir')()
			.then(() =>
			{
				return del(
					this.settings.buildPath,
					{
						force: this.settings.buildDeleteOutsideOfToolsDir
					}
				)
					.then(
						() =>
						{
							return this.utils.runHooks('afterCleanBuildDir')();
						}
					);
			});
	}

}

/**
 * Module export
 */
module.exports = Cleaner;


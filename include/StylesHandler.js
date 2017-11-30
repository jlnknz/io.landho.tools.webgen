/*
 * Website generator v2 - StylesHandler.js
 */

'use strict';

/**
 * Load module dependencies.
 */
const gulp = require('gulp');
const gutil = require('gulp-util');
const plumber = require('gulp-plumber');
const path = require('path');
const sourcemaps = require('gulp-sourcemaps');
const sass = require('gulp-sass');
const base64 = require('gulp-base64');
const autoprefixer = require('gulp-autoprefixer');
const concat = require('gulp-concat');
const rename = require('gulp-rename');
const tap = require('gulp-tap');
const scssLint = require('gulp-scss-lint');
const del = require('del');
const cleanCss = require('gulp-clean-css');
const exec = require('child_process').exec;
const noop = require('gulp-util').noop;
const Utils = require('./Utils');
const PathHelper = require('./PathHelper');

/**
 * Module responsible for handlding SCSS and CSS styles.
 *
 * All operations are performed on both file types, so it may happen that the linter reports inappropriate
 * warnings for CSS files. For example, it will warn if we use hard-coded color values, but variables are
 * not available in plain CSS.
 */
class StylesHandler {

	/**
	 * Constructor
	 *
	 * @param config
	 */
	constructor(config)
	{
		this.config = config;
		this.settings = config.settings;
		this.utils = new Utils(config);
		this.pathHelper = new PathHelper(this.config);
		this.sets = {};

		// check that the configuration is valid for this module
		config.onLoad(() =>
		{
			Utils.assert(this.settings.styles, 'No configuration section for styles.');
			Utils.assert(this.settings.styles.sets, 'No sets defined for styles.');
			Utils.assert(typeof this.settings.styles.sets === 'object', 'Sets for styles in not an object.');
			Utils.assert(this.settings.styles.filesToLint, 'No styles files to Lint defined.');
			Utils.assert(this.settings.styles.scssLintConfig, 'No SCSS lint configuration file.');
			this._checkScssLintIsInstalled(); // will throw an error

			// optional: this.settings.licenseTemplateFile

			// finalize configuration
			for (let s in this.settings.styles.sets) {
				if (this.settings.styles.sets.hasOwnProperty(s)) {
					Utils.assert(Array.isArray(this.settings.styles.sets[s].input), `Invalid input for styles set |${s}|.`);
					this.sets[s] = {};
					this.sets[s].input = this.utils.filterBuildPath(this.settings.styles.sets[s].input);
					if (this.settings.styles.sets[s].watch) {
						Utils.assert(Array.isArray(this.settings.styles.sets[s].watch), `Invalid watch for styles set |${s}|.`);
						this.sets[s].watch = this.utils.filterBuildPath(this.settings.styles.sets[s].watch);
					}
					else {
						this.sets[s].watch = this.sets[s].input;
					}

					this.sets[s].options = this.settings.styles.sets[s].options || {};
					// sass includePaths options is always relative to the root of the project
					if (this.sets[s].options.sassIncludePaths) {
						Utils.assert(Array.isArray(this.sets[s].options.sassIncludePaths), 'sassIncludePaths is not an array');
						this.sets[s].options.sassIncludePaths =
							this.sets[s].options.sassIncludePaths
								.map((p) => path.resolve(this.settings.root + '/' + p));
					}
				}
			}
		});
	}

	/**
	 * Execute a function all all sets.
	 */
	doOnAllSets(f)
	{
		return Utils.doOnAllSets(this.sets, f);
	}

	/**
	 * Process all sets at once
	 */
	processAllSets()
	{
		return this.doOnAllSets(
			(set) =>
			{
				return new Promise((resolve) =>
				{
					return this.process(set, resolve);
				});
			}
		);
	}

	/**
	 * SCSS-lint the app styles
	 */
	lint()
	{
		return this.doOnAllSets(
			(set) =>
			{
				return new Promise((resolve) =>
				{
					return gulp.src(set.input)
						.on('end', resolve)
						.pipe(scssLint(
							{
								config: (this.settings.styles.scssLintConfig.startsWith('/')
									?
									this.settings.toolsRoot + this.settings.styles.scssLintConfig
									:
									this.settings.root + '/' + this.settings.styles.scssLintConfig)
							}
						))
						.pipe(scssLint.failReporter('E'));
				});
			}
		);
	}

	/**
	 * Process an SCSS stream of files
	 *
	 */
	process(set, resolve)
	{
		let inputFilesMatchers = set.input;
		let outputFilename = set.output;
		let sassOptions = {};
		if (set.options.sassIncludePaths) {
			sassOptions.includePaths = set.options.sassIncludePaths;
		}

		let oldOutputFilenames = this.settings.buildPath + '/' + outputFilename.replace(/(\.[^.]+)$/, '.*$1');
		let toRemove = [
			oldOutputFilenames,
			oldOutputFilenames + '.map'
		];
		return del(toRemove)
			.then(() =>
			{
				gutil.log(gutil.colors.magenta('[styles]'), 'Updating...');
				return gulp.src(inputFilesMatchers)
					.on('end', () =>
					{
						// because process() is not a task, no automatic display of what we are doing.
						gutil.log(gutil.colors.magenta('[styles]'), 'done.');
						if (resolve) {
							resolve();
						}
					})
					.pipe(plumber())
					.pipe(this.utils.runHooks('beforeStylesProcessing')())
					// Initialize source maps
					.pipe(!this.settings.isRelease ? sourcemaps.init() : noop())
					// Run the SASS preprocessor
					.pipe(sass(sassOptions).on('error', sass.logError))
					// Convert images to embedded base64 version if they are small enough
					.pipe(base64({
						extensions: ['svg', 'png', 'gif', 'jpg'],
						maxImageSize: 8 * 1024 // bytes
					}))
					// Add CSS prefixes for reasonably recent browsers
					.pipe(autoprefixer())
					// Concatenate all CSS files
					.pipe(concat(outputFilename))
					// fix paths
					.pipe((this.pathHelper.correctCssPathsProcessor())())
					// Clean CSS
					.pipe(this.settings.isRelease ? cleanCss({compatibility: 'ie8'}) : noop())
					// Rename the concatenated file
					.pipe(rename({suffix: this.settings.buildAssetsSuffix}))
					// Write source maps
					.pipe(!this.settings.isRelease ? sourcemaps.write('.') : noop())
					// Add a license to the very top of the file if this is not a vendor CSS
					.pipe(tap(
						(file) =>
						{
							if (this.settings.licenseTemplateFile
								&& this.settings.isRelease
								&& outputFilename !== this.settings.styles.outputFilenameVendors
							) { // don't add our license to vendor css)
								let input = file.contents.toString();
								let l = this.utils.getLicense("/*\n", "\n */\n", ' * ', file);
								input = l + input;
								file.contents = new Buffer(input);
							}
						}
					))
					.pipe(this.utils.runHooks('afterStylesProcessing')())
					.pipe(gulp.dest(this.settings.buildPath))


			});
	}

	/**
	 * Check that the scss-lint command is installed.
	 *
	 * Unfortunately, this is not a nodejs module, so we need this manual check.
	 *
	 * @private
	 */
	_checkScssLintIsInstalled()
	{
		exec('scss-lint -v',
			(error) =>
			{
				if (error) {
					Utils.die(
						'The Ruby gem \'scss-lint\' is not installed but is required. Install it with:\n' +
						'$ gem install scss_lint'
					);
				}
			}
		);
	}

}

/**
 * Module export
 *
 * @type {StylesHandler}
 */
module.exports = StylesHandler;

/*
 * Website generator v2 - ScriptsHandler.js
 */

'use strict';

/**
 * Load module dependencies
 */
const gulp = require('gulp');
const plumber = require('gulp-plumber');
const path = require('path');
const del = require('del');
const lazypipe = require('lazypipe');
const gulpIf = require('gulp-if');
const sourcemaps = require('gulp-sourcemaps');
const concat = require('gulp-concat');
const rename = require('gulp-rename');
const uglify = require('gulp-uglify');
const tap = require('gulp-tap');
const tslint = require('gulp-tslint');
const through2 = require('through2').obj;
const eslint = require('gulp-eslint');
const noop = require('gulp-util').noop;
const browserify = require('browserify');
const intoStream = require('into-stream');
const mocha = require('gulp-mocha');
const tsify = require('tsify');
const Utils = require('./Utils');

/**
 * Module responsible for handling JavaScript and TypeScript scripts.
 */
class ScriptsHandler {

	/**
	 * Constructor
	 *
	 * @param config
	 */
	constructor(config)
	{
		this.settings = config.settings;
		this.utils = new Utils(config);
		this.sets = {};

		// check that the configuration is valid for this module
		config.onLoad(() => {
			Utils.assert(this.settings.scripts, 'No configuration section for scripts.');
			Utils.assert(this.settings.scripts.sets, 'No sets defined for scripts.');
			Utils.assert(typeof this.settings.scripts.sets === 'object', 'Sets for scripts in not an object.');

			Utils.assert(this.settings.scripts.typeScriptFilesToLint, 'No TypeScript files to Lint defined.');
			Utils.assert(this.settings.scripts.javaScriptFilesToLint, 'No JavaScript files to Lint defined.');

			Utils.assert(this.settings.scripts.unitTests, 'No unit tests input filter.');

			Utils.assert(this.settings.scripts.jsLintConfig, 'No JS lint configuration file.');
			Utils.assert(this.settings.scripts.tsLintConfig, 'No TS lint configuration file.');
			Utils.assert(this.settings.scripts.babelConfig, 'No babel configuration file.');
			Utils.assert(this.settings.scripts.mochaConfig !== undefined, 'No mocha configuration for scripts');
			// input sanitization made by gulp-mocha/mocha
			Utils.assert(this.settings.scripts.mochaConfig.interface, 'No mocha interface defined.');
			Utils.assert(this.settings.scripts.mochaConfig.reporter, 'No mocha reporter defined.');

			// optional: this.settings.licenseTemplateFile

			// finalize configuration
			// content input
			for (let s in this.settings.scripts.sets) {
				if (this.settings.scripts.sets.hasOwnProperty(s)) {
					Utils.assert(Array.isArray(this.settings.scripts.sets[s].input), `Invalid input for scripts set |${s}|.`);
					this.sets[s] = {};
					this.sets[s].input = this.utils.filterBuildPath(
						this.settings.scripts.sets[s].input
							.slice()
							.concat(Utils.negatePaths(this.settings.scripts.unitTests))
					);
					if (this.settings.scripts.sets[s].watch) {
						Utils.assert(Array.isArray(this.settings.scripts.sets[s].watch), `Invalid watch for scripts set |${s}|.`);
						this.sets[s].watch = this.utils.filterBuildPath(
							this.settings.scripts.sets[s].watch
								.slice()
								.concat(Utils.negatePaths(this.settings.scripts.unitTests))
						);
					}
					else {
						this.sets[s].watch = this.sets[s].input;
					}

					this.sets[s].options = this.settings.scripts.sets[s].options || {};
				}
			}

			// lint
			this.settings.scripts.typeScriptFilesToLint =
				this.utils.filterBuildPath(this.settings.scripts.typeScriptFilesToLint);
			this.settings.scripts.javaScriptFilesToLint =
				this.utils.filterBuildPath(this.settings.scripts.javaScriptFilesToLint);

			// unit tests
			this.settings.scripts.unitTests =
				this.utils.filterBuildPath(this.settings.scripts.unitTests);
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
			(set) => {
				return new Promise((resolve) => {
					return this.process(set)
						.on('end', resolve());
				});
			}
		);
	}

	/**
	 * Handle a stream starting with a TypeScript files
	 *
	 * We assume that the whole application is typescript. This not a problem as typescript is a superset of javascript.
	 */
	process(set)
	{
		let inputFilesMatchers = set.input;
		let outputFilename = set.output;
		let options = set.options;

		let oldOutputFilenames = this.settings.buildPath + '/' + outputFilename.replace(/(\.[^.]+)$/, '.*$1');
		let toRemove = [
			oldOutputFilenames,
			oldOutputFilenames + '.map'
		];
		return del(toRemove)
			.then(() => {
				return gulp.src(inputFilesMatchers)
					.pipe(plumber())
					.pipe(!this.settings.isRelease ? sourcemaps.init() : noop())
					// and then handle javascript
					.pipe(this._processJavascript(outputFilename, options)())
					.on('error', function (ev) {
						console.error(outputFilename, options, ev);
					})
					// add the license
					.pipe(tap(
						(file) => {
							if (this.settings.licenseTemplateFile && this.settings.isRelease && !options.noLicense) {
								let input = file.contents.toString();
								let l = this.utils.getLicense("/*\n", "\n */\n", ' * ', file);
								input = l + input;
								file.contents = new Buffer(input);
							}
						}
					))
					// output
					.pipe(gulp.dest(this.settings.buildPath));
			});
	}

	/**
	 * Perform QA operation on TypeScript files stream
	 */
	lintTypeScript()
	{
		return gulp.src(this.settings.scripts.typeScriptFilesToLint)
			.pipe(tslint({
				configuration: this.settings.scripts.tsLintConfig.startsWith('/')
					? this.settings.toolsRoot + this.settings.scripts.tsLintConfig
					: this.settings.root + '/' + this.settings.scripts.tsLintConfig,
				formatter: "prose"
			}))
			.pipe(tslint.report(
				{
					emitError: true,
					summarizeFailureOutput: true
				}
			));
	}

	/**
	 * Perform QA operation on JavaScript files stream
	 */
	lintJavaScript()
	{
		return gulp.src(this.settings.scripts.javaScriptFilesToLint)
			.pipe(eslint({
				configFile: this.settings.scripts.jsLintConfig.startsWith('/')
					? this.settings.toolsRoot + this.settings.scripts.jsLintConfig
					: this.settings.root + '/' + this.settings.scripts.jsLintConfig,
				fix: false
			}))
			.pipe(eslint.format())
			.pipe(eslint.results(results => {
				// Called once for all ESLint results.
				console.info(`Total Results: ${results.length}`);
				console.info(`Total Warnings: ${results.warningCount}`);
				console.info(`Total Errors: ${results.errorCount}`);
			}))
			.pipe(eslint.failAfterError());
	}

	/**
	 * Do run unit tests for JavaScript
	 */
	runUnitTests()
	{
		let config = {
			ui: this.settings.scripts.mochaConfig.interface,
			reporter: this.settings.scripts.mochaConfig.reporter
		};
		return gulp.src(this.settings.scripts.unitTests)
		// FIXME does not work for now
		/*	.pipe(typescript({
			 noImplicitAny: true,
			 target: "es6",
			 allowJs: true
			 })) */
			.pipe(mocha(config));
	}

	/**
	 * Process a javascript files stream
	 */
	_processJavascript(outputFilename, options)
	{
		return lazypipe()
			.pipe(this.utils.runHooks('beforeJavaScriptProcessing'))
			// concat all javascript files
			.pipe(concat, outputFilename)
			// browserify with babelify transform if no noTransform setting
			.pipe(
				() => {
					return gulpIf(
						!options.noTransform,
						through2(
							(file, enc, next) => {
								// we have already concat() the files, but let's move to the original file path
								// such that relative references to other modules are still good
								let originalDirPath = path.dirname(file.history[0]);
								// browserify only accepts streams as input
								return browserify(
									intoStream(file.contents),
									{
										basedir: originalDirPath
									}
								)
								/*	.plugin(tsify, // FIXME is that ok to transpile even though we have js as input? to check.
										{
											noImplicitAny: true,
											target: 'es6'
										}
									) */
									.transform('babelify',
										require(
											this.settings.scripts.babelConfig.startsWith('/')
												? this.settings.toolsRoot + this.settings.scripts.babelConfig
												: this.settings.root + '/' + this.settings.scripts.babelConfig
										)
									)

									.bundle((err, res) => {
										if (err) {
											return next(err);
										}

										file.contents = res;
										next(null, file);
									});
							}
						)
					);
				}
			)
			// uglify
			.pipe(
				() => {
					return gulpIf(
						this.settings.isRelease,
						uglify()
					)
				}
			)
			// rename to final name
			.pipe(rename, {suffix: this.settings.buildAssetsSuffix})
			.pipe(
				() => {
					return gulpIf(
						!this.settings.isRelease,
						sourcemaps.write('.')
					);
				}
			)
			.pipe(this.utils.runHooks('afterJavaScriptProcessing'));
	}
}


/**
 * Module export
 *
 * @type {ScriptsHandler}
 */
module.exports = ScriptsHandler;







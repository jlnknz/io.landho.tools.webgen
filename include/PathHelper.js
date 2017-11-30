/**
 * Website generator v2 - PathHelper.js
 */

'use strict';

/**
 * Load module dependencies
 */
const lazypipe = require('lazypipe');
const tap = require('gulp-tap');
const path = require('path');
const through2 = require('through2').obj;
const Utils = require('./Utils');

/**
 * Module providing helpers for handling paths
 */
class PathHelper {

	/**
	 * Constructor
	 */
	constructor(config, baseContext)
	{
		this.settings = config.settings;
		this.baseContext = baseContext;
		this.utils = new Utils(config);
	}

	/**
	 * Get the pipe to demux paths, i.e. take an input file, and create multiple files depending on the different
	 * languages that are defined in its YAML header (which is stored in the base context)
	 */
	demuxProcessor()
	{
		if (!this.baseContext) {
			throw 'ERROR: cannot initialize PathHelper with an empty base context';
		}
		let _self = this;
		return lazypipe()
			.pipe(this.utils.runHooks('beforeDemuxPaths'))
			.pipe(through2,
				function (file, enc, cb)
				{
					let pipe = this;

					let contentConfig = _self.baseContext.contents[file.relative];

					// multiplexing if more than one language
					for (let lang in contentConfig.translationSet) {
						if (contentConfig.translationSet.hasOwnProperty(lang)) {
							let f = file.clone();
							// save the language for modules that may not have access to the whole context
							// (i.e. I18nHelper which is used for plain HTML contents)
							f.lang = lang;

							f.path = path.join(_self.settings.sourceRoot, 'contents/', contentConfig.translationSet[lang]);
							pipe.push(f);
						}
					}

					cb();
				}
			)
			.pipe(this.utils.runHooks('afterDemuxPaths'));
	}

	/**
	 * Correct paths in contents such that resulting files still link to files that were refered to
	 * in the source document
	 */
	correctContentPathsProcessor()
	{
		return lazypipe()
			.pipe(this.utils.runHooks('beforeContentPathsCorrection'))
			.pipe(tap,
				(file) =>
				{
					// href|src + = + quote + link + quote
					let linkPattern = /((src|href)=)("|')((?!(mailto:|\/\/:|\/|#|https?:\/\/))[^\3]*?)\3/gm;
					// start counting at 1 (0 is the full match)
					let matches = {
						prefix: 1,
						quoteStart: 3,
						quoteEnd: 3,
						link: 4
					};
					let input = this._replacePaths(linkPattern, matches, file);
					file.contents = new Buffer(input);

					// without quotes (also valid HTML5)
					// FIXME does not work without quotes (which is HTML5-valid)
					/*linkPattern = /((src|href)=)(?!('|"))((?!(mailto:|\/\/:|\/|https?:\/\/))[^\s]*?)/gm;
					// start counting at 1 (0 is the full match)
					matches = {
						prefix: 1,
						link: 3
					};
					input = this._replacePaths(linkPattern, matches, file);
					file.contents = new Buffer(input);
					*/
				})
			.pipe(this.utils.runHooks('afterContentPathsCorrection'));
	}

	/**
	 * Correct paths in CSS files
	 */
	correctCssPathsProcessor()
	{
		return lazypipe()
			.pipe(this.utils.runHooks('beforeCssPathsCorrection'))
			.pipe(tap,
				(file) =>
				{
					// capturing parenthesis: (prefix, nil, quote, link, quoteEnd, suffix)
					let linkPattern = /(url\()('|")([^\2]*?)\2(\))/gm;
					let matches = {
						prefix: 1,
						quoteStart: 2,
						link: 3,
						quoteEnd: 2,
						suffix: 4
					};
					let input = this._replacePaths(linkPattern, matches, file);
					file.contents = new Buffer(input);
				})
			.pipe(this.utils.runHooks('afterCssPathsCorrection'));
	}


	/**
	 * Fix the paths identified by linkPattern in the provided input
	 *
	 * linkPattern: the regexp against which links strings will match
	 * matches: an object that describes the matches between capturing parenthesis and matching parts
	 * input: a file object
	 */
	_replacePaths(linkPattern, matches, file)
	{
		// accessing captured[999] will return undefined
		let defaultMatches = {
			all: 0,
			prefix: 999,
			quoteStart: 999,
			quoteEnd: 999,
			link: 999,
			suffix: 999
		};
		matches = Object.assign(defaultMatches, matches);
		let input = file.contents.toString();

		return input.replace(
			linkPattern,
			// match, prefix, nil, quote, link, quoteEnd, suffix
			(...captured) =>
			{
				let link = captured[matches.link];
				if (!link) {
					return captured[matches.all];
				}
				let prefix = captured[matches.prefix] || '';
				let quoteStart = captured[matches.quoteStart] || '';
				let quoteEnd = captured[matches.quoteEnd || matches.quoteStart] || '';
				let suffix = captured[matches.suffix] || '';

				// relative to contents, so remove the trailing ../ to
				// start the logic relative to the build path
				if (link.startsWith('../')) {
					link = link.replace(/^\.\.\//, '');
				}

				// relative to buildpath from here (absolute paths are excluded by the regexp)
				let processedFilePath = file.relative;

				// remove common parts at the beginning of the processed file path and captured link
				let dirPartPattern = /^([^\/]+\/)/;
				let linkMatches;
				let mismatch = false;
				while (!mismatch && (linkMatches = dirPartPattern.exec(processedFilePath))) {
					if (link.startsWith(linkMatches[1])) {
						link = link.replace(dirPartPattern, '');
						processedFilePath = processedFilePath.replace(dirPartPattern, '');
					}
					else {
						mismatch = true;
					}
				}

				// how deep is the processed file in the directory hierarchy
				// compared to the target link, starting from their common root
				let processedFileDepth = (processedFilePath.match(/\//g) || []).length;
				// add enough ../ to reach build path
				for (let i = 0; i < processedFileDepth; ++i) {
					link = '../' + link;
				}

				link = PathHelper.getPathWithoutDirectoryIndex(link, this.settings.content.directoryIndexPattern);


				quoteEnd = quoteEnd || quote || '';
				suffix = suffix || '';
				return prefix + quoteStart + link + quoteEnd + suffix;
			}
		);
	}

	/**
	 * Get the path without the directory index part
	 *
	 * we use this method when the settings object is not ready, yet, so
	 * we pass the index pattern as a parameter
	 *
	 * FIXME to review, we may use instance variable in the end, but we must make sure that
	 * the required elements are ready.
	 *
	 * @param path
	 * @param indexPattern
	 * @returns {*}
	 */
	static getPathWithoutDirectoryIndex(path, indexPattern)
	{
		// remove directory index if this is possible
		if (indexPattern) {
			// replace if the link matches the pattern BUT do not if there is nothing in front of the
			// pattern to avoid to return empty link string. In this case we return the current directory
			// link (./)
			if (new RegExp('^' + indexPattern).test(path)) {
				path = './';
			}
			else {
				path = path.replace(new RegExp(indexPattern), '');
			}
		}
		return path;
	}
}

/**
 * Export module
 *
 * @type {PathHelper}
 */
module.exports = PathHelper;

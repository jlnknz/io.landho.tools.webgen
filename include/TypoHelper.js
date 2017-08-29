/**
 * Website generator v2 - I18nHelper.js
 */

'use strict';

/**
 * Load module dependencies
 */
const lazypipe = require('lazypipe');
const tap = require('gulp-tap');
const XRegExp = require('xregexp');
const Utils = require('./Utils');

/**
 * Module providing typographic enhancement utilities
 */
class TypoHelper {

	/**
	 * Constructor
	 *
	 * @param config
	 */
	constructor(config)
	{
		this.settings = config.settings;
		this.utils = new Utils(config);
	}

	/**
	 * Obtain a pipe that corrects typography of what passes through it
	 */
	getTypoProcessor()
	{
		return lazypipe()
			.pipe(this.utils.runHooks('beforeTypoCorrection'))
			.pipe(tap,
				(file) =>
				{
					let input = this._processTypo(file.contents.toString(), file.lang);
					file.contents = new Buffer(input);
				}
			)
			.pipe(this.utils.runHooks('afterTypoCorrection'));
	}

	/**
	 * Multi-language and general purpose typographic corrections
	 *
	 * @private
	 */
	_processTypo(content, lang)
	{
		// exclude contents of <no-typo> tag and replace it with a placeholder such
		// that we can later recover it easily
		let noTypos = [];
		content = content
			.replace(/<no-typo>([^]*?)<\/no-typo>/gm, function (match, protectedContent)
			{
				noTypos.push(protectedContent);
				return `<no-typo id="${noTypos.length - 1}" />`;
			});

		// if <no-break>, then replace all spaces with &nbsp;
		content = content
			.replace(/<no-break>([^]*?)<\/no-break>/gm, function (match, protectedContent)
			{
				return protectedContent
					.trim()
					.replace(/\s+/gm, '&nbsp;');
			});

		// do processing that is not dependent on language
		switch (lang) {
			// case 'fr': // FIXME
			case 'en':
			default:
				content = this._processEnglishTypo(content);
		}

		// recover <no-typo> content
		content = content
			.replace(/<no-typo id="(\d+)" \/>/gm, function (match, noTypoId)
			{
				return noTypos[parseInt(noTypoId)];
			});

		return content;
	}

	/**
	 * English typographic corrections
	 *
	 * FIXME implement normative typographic corrections. For now that's an approximation at best.
	 *
	 * @param input
	 * @private
	 */
	_processEnglishTypo(input)
	{
		return input
			.replace(
				/>(\s*)([^<]+?)(\s*)</gm,
				function (match, spaceBefore, content, spaceAfter)
				{
					content = content
					// digit space something -> digit &nbsp; something
						.replace(/(\s+\d+)\s+/gm, '$1&nbsp;')
						// something SPACE|&nbsp; single-letter space something
						// -> something single-letter SPACE|&nbsp; single-letter &nbsp; something
						.replace(new XRegExp("(\\s+\\p{L}{1})\\s+", 'gm'), '$1&nbsp;')
						.replace(new XRegExp("(&nbsp;\\p{L}{1})\\s+", 'gm'), '$1&nbsp;');
					// FIXME do not allow orphan word at end of sentence.
					// FIXME how to detect what is end of sentence? a bit difficult within HTML
					return '>' + spaceBefore + content + spaceAfter + '<';

				});
	}
}

/**
 * Module export
 *
 * @type {TypoHelper}
 */
module.exports = TypoHelper;

/**
 * Website generator v2 - I18nHelper.js
 */

'use strict';

/**
 * Load module dependencies
 */
const csvjson = require('csvjson');
const tap = require('gulp-tap');
const lazypipe = require('lazypipe');
const fs = require('fs');
const Utils = require('./Utils');

/**
 * Module responsible for providing i18n features
 */
class I18nHelper {

	/**
	 * Constructor
	 * @param config
	 */
	constructor(config)
	{
		this.settings = config.settings;
		this.utils = new Utils(config);

		// check that the configuration is valid for this module
		config.onLoad(() =>
		{
			Utils.assert(this.settings.i18n, 'No configuration section for i18n.');
			Utils.assert(this.settings.i18n.source, 'No translation source file.');
			Utils.assert(this.settings.i18n.fallbackLanguage, 'No fallback language specified.');
			Utils.assert(this.settings.i18n.labels, 'No translations for i18n labels have been defined.');
			Utils.assert(typeof this.settings.i18n.labels === 'object', 'Translations for i18n labels that have been defined is not an object.');
		});

		// finish object configuration
		config.onLoad(() =>
		{
			this.i18nData = this._initI18nData();
			this.validLanguages = Object.keys(this.settings.i18n.labels);
		});
	}

	/**
	 * Get a specific translation
	 */
	getTranslation(source, lang)
	{
		source = I18nHelper._normalizeI18nString(source);
		if (this.i18nData) {
			if (this.i18nData[source]) {
				if (this.i18nData[source][lang]) {
					return this.i18nData[source][lang];
				}
			}
		}
		return false;
	}

	/**
	 * Extract i18n strings from and update the config.i18n.source file according to the result
	 */
	extractI18nProcessor(extractedStrings)
	{
		return lazypipe()
			.pipe(tap,
				(file) =>
				{
					let input = file.contents.toString();
					// parse the content for i18n tags and brace syntax.
					// and store everything into extractedStrings

					// possible to DRY? we share some code with getI18nProcessor
					let i18nTagRegexp = /(<i18n>([^]*?)<\/i18n>)/m;
					let i18nBraceRegexp = /(\{i18n\s+?([^]*?)\s*?})/m; //FIXME: not good enough for {i18n blah } blah } -> add escape \}?
					// FIXME perhaps unique syntax _('blahblah') ?
					let result;
					while ((result = i18nTagRegexp.exec(input)) || (result = i18nBraceRegexp.exec(input))) {
						let wholeMatch = result[1];
						let source = result[2];
						if (source.indexOf('{{') !== 0) {
							source = source.replace(/\n/mg, ' ').replace(/([\s]+)/mg, ' ').trim();
							if (!extractedStrings[source]) {
								extractedStrings[source] = {
									'source file (first match)': file.path.replace(this.settings.sourceRoot, ''),
									'comment': this.getTranslation(source, 'comment') || ''
								};
								this.validLanguages.map((lang) =>
									{
										let res = source;
										if (lang !== this.settings.i18n.fallbackLanguage) {
											res = this.getTranslation(source, lang) || '';
										}
										extractedStrings[source][lang] = res;
									}
								);
							}
						}
						input = input.split(wholeMatch).join('');
					}
				}
			);
	}

	/**
	 * Build the i18n source file (CSV) out of extracted strings
	 *
	 * FIXME if a string has been removed and the i18n strings are extracted again, then we lose this string.
	 * FIXME that may not be wanted, i.e. user may extract again later with again this string in the contents,
	 * FIXME and whishes to keep the translation.
	 *
	 * @param extractedStrings
	 */
	buildI18nSourceFileProcessor(extractedStrings)
	{
		return lazypipe()
			.pipe(tap,
				(file) =>
				{
					extractedStrings = Object.keys(extractedStrings).map((key) => extractedStrings[key]);

					let all = [];
					if (extractedStrings.length) {
						// header
						all.push(Object.keys(extractedStrings[0]).join(','));

						// values
						extractedStrings.map((v) =>
						{
							let values = Object.keys(v).map((key) => v[key]);
							let row = values.slice(0,values.length - this.validLanguages.length);
							this.validLanguages.map((w) =>
							{
								row.push('"' + v[w].replace(/"/g, '""') + '"');
							});
							all.push(row.join(','));
						});
					}
					file.contents = new Buffer(all.join('\r\n'));
				});
	}

	/**
	 * Get a pipe for translating passed content.
	 *
	 * The language is detected via the lang="..." HTML attribute
	 *
	 * There are 2 syntaxes for translating content:
	 * - <i18n>Translate this string</i18n>
	 * - {i18n Translate this string}
	 *
	 * If no translation is available, this method will attempt to get the translation in the fallback language,
	 * which is defined in the configuration file (this.settings.i18n.fallbackLanguage).
	 *
	 * If no translation is available, a warning will be shown. If no in release mode, the missing translation
	 * will be enclosed in a '<span class="debug error i18n-missing-translation">' tag.
	 */
	getI18nProcessor()
	{
		return lazypipe()
			.pipe(this.utils.runHooks('beforeI18nProcessing'))
			.pipe(tap, (file) => this._processTagFilters(file, '', true))
			.pipe(tap, (file) => this._processTagFilters(file, 'not-', false))
			.pipe(tap,
				(file) =>
				{
					// originalPath is only used for displaying which file has i18n problems.
					let originalPath = file.history[0].replace(/^.*\//, '');
					let input = file.contents.toString();
					let lang = file.lang;

					let i18nTagRegexp = /(<i18n>([^]*?)<\/i18n>)/m;
					let i18nBraceRegexp = /(\{i18n\s+?([^]*?)\s*?})/m;
					let result;
					while ((result = i18nTagRegexp.exec(input)) || (result = i18nBraceRegexp.exec(input))) {
						let wholeMatch = result[1];
						let source = result[2];
						source = source.replace(/\n/mg, ' ').replace(/([\s]+)/mg, ' ').trim();
						let translation;
						if (lang) {
							translation = this.getTranslation(source, lang);
							if (!translation) {
								let missingTranslationClass = 'i18n-missing-translation';
								Utils.warn('i18n', originalPath, `Cannot find translation for |${source}| in |${lang}|. Falling back to fallback language |${this.settings.i18n.fallbackLanguage}|.`);
								translation = this.getTranslation(source, this.settings.i18n.fallbackLanguage);
								if (translation) {
									missingTranslationClass += ' i18n-is-language-fallback';
								}
								else {
									Utils.warn('i18n', originalPath, `Also no translation for the fallback language |${this.settings.i18n.fallbackLanguage}|.`);
									missingTranslationClass += ' i18n-no-language-fallback'
								}
								if (this.settings.isRelease) {
									if (!translation) {
										translation = source;
									}
								}
								else {
									translation = '<span class="webgen-debug webgen-error i18n-error '
										+ missingTranslationClass + '">' + source + '</span>';
								}
							}
						}
						else {
							translation = source;
							Utils.warn('i18n', originalPath, `An <i18n> tag has been found in a non-translated file: |${source}|.`);
						}
						input = input.split(wholeMatch).join(translation); // ~ str replace of all occurrences in whole file
					}

					file.contents = new Buffer(input);
				}
			)
			.pipe(this.utils.runHooks('afterI18nProcessing'));
	}

	/**
	 * Autodetect the language in the file that is provided or return false if none
	 * could be detected.
	 *
	 * @param file
	 */
	autoDetectLanguage(file)
	{
		// lang comes from lang attribute from <html> tag
		// FIXME bad regexp ??? xml:lang="{{lang}}" lang="{{lang}}"
		let langRegexp = /<html\s+?[^>]*?lang=(["'])([a-z\-]+?)\1[^>]*?>/;
		let lang = langRegexp.exec(file.contents.toString());
		if (lang) {
			return lang[2];
		}
		else {
			return false;
		}

	}

	/**
	 * Process the input by analysing tags and excluding some strings depending on the current language.
	 */
	_processTagFilters(file, prefixTag, keepSame)
	{
		let input = file.contents.toString();
		let lang = file.lang;

		this.validLanguages.map((l) =>
		{
			let keep = l === lang;
			keep = keepSame ? keep : !keep;
			input = input.replace(
				new RegExp(`<${prefixTag}${l}[^>]*>([^]*?)<\/${prefixTag}${l}>`, 'gm'),
				keep ? '$1' : ''
			)
		});
		file.contents = new Buffer(input);
	}

	/**
	 * Initialize the i18n reference structure.
	 */
	_initI18nData()
	{
		let data;
		try {
			data = fs.readFileSync(this.settings.i18n.source, {encoding: 'utf8'});
		}
		catch (e) {
			// file not found,  not readable, etc.
			// we do not through an error as we might have an application where i18n is not required
			Utils.warn('i18n', `Cannot read i18n input file |${this.settings.i18n.source}|.`);
			return {};
		}
		data = csvjson.toObject(data);

		let res = {};
		data.forEach(
			(row) =>
			{
				if (!row[this.settings.i18n.fallbackLanguage]) {
					return;
				}
				let key = row[this.settings.i18n.fallbackLanguage];
				for (let lang in row) {
					if (row.hasOwnProperty(lang)) {
						if (!res[key]) {
							res[key] = {};
						}
						res[key][lang] = I18nHelper._normalizeI18nString(row[lang]);
					}
				}
			}
		);
		return res;
	}

	/**
	 * Normalize a translatable string: remove leading/trailing spaces, and duplicate spaces in the string.
	 */
	static _normalizeI18nString(str)
	{
		return str.replace(/\s+/gm, ' ')
			.replace(/^\s+/, '')
			.replace(/\s+$/, '');
	}
}

/**
 * Module export
 * @type {I18nHelper}
 */
module.exports = I18nHelper;




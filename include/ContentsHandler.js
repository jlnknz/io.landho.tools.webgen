/**
 * Website generator v2 - ContentHandlers.js
 */

'use strict';

/**
 * Load module dependencies
 */
const handlebars = require('handlebars');
const plumber = require('gulp-plumber');
const fs = require('fs');
const YAML = require('yamljs');
const gulp = require('gulp');
const lazypipe = require('lazypipe');
const path = require('path');
const marked = require('marked');
const merge = require('merge');
const tap = require('gulp-tap');
const gulpIf = require('gulp-if');
const htmlReplace = require('gulp-html-replace');
const prettify = require('gulp-prettify');
const htmlhint = require('gulp-htmlhint');
const htmlmin = require('gulp-htmlmin');
const through2 = require('through2').obj;
const Utils = require('./Utils');
const PathHelper = require('./PathHelper');
const I18nHelper = require('./I18nHelper');
const TypoHelper = require('./TypoHelper');
const XmlSitemapHelper = require('./XmlSitemapHelper');

/**
 * Module responsible to handle contents. It supports:
 * - processing of handlebars, markdown, and HTML
 * - templating via masters (handlebars) including above mentioned document types
 */
class ContentsHandler {

	/**
	 * Constructor
	 *
	 * @param config
	 */
	constructor(config)
	{
		this.settings = config.settings;
		this.utils = new Utils(config);
		this.htmlReplaceOptions = null;


		// Helpers
		this.i18nHelper = new I18nHelper(config);
		this.typoHelper = new TypoHelper(config);
		this.xmlSitemapHelper = new XmlSitemapHelper(config);

		// check that the configuration is valid for this module
		config.onLoad(() => {
			Utils.assert(this.settings.content, 'No configuration section for contents.');
			Utils.assert(this.settings.content.input, 'No input filter for template contents.');
			Utils.assert(this.settings.content.htmlLintConfig, 'No configuration for HTML linter.');

			// HTML minification (optional) - correct the path for later use
			if (this.settings.content.minifyHtmlConfig) {
				this.settings.content.minifyHtmlConfig = this.settings.content.minifyHtmlConfig.startsWith('/')
					? this.settings.toolsRoot + this.settings.content.minifyHtmlConfig
					: this.settings.root + '/' + this.settings.content.minifyHtmlConfig;
			}

			Utils.assert(this.settings.htmlReplaceConfig, 'No HTML replace configuration has been computed.');
			Utils.assert(typeof this.settings.htmlReplaceConfig === 'object', 'HTML replace configuration is not an object.');

			// optional: this.settings.licenseTemplateFile

			Utils.assert(this.settings.i18n.fallbackLanguage, 'No fallback language has been defined.');
			Utils.assert(this.settings.i18n.labels, 'No translations for i18n labels have been defined.');
			Utils.assert(typeof this.settings.i18n.labels === 'object', 'Translations for i18n labels that have been defined is not an array.');
			// optional partials
			if (this.settings.content.partials) {
				Utils.assert(typeof this.settings.content.partials === 'object', 'Defined partials is not an object');
				// fix the partial path for later use
				for (let partialName in this.settings.content.partials) {
					if (this.settings.content.partials.hasOwnProperty(partialName)) {
						let filePath = this.settings.content.partials[partialName];
						// partials with path starting with / are relative to the toolsRoot. Others are relative to the this.settings.root
						if (filePath.startsWith('/')) {
							filePath = this.settings.toolsRoot + filePath;
						}
						else {
							filePath = this.settings.sourceRoot + '/' + filePath;
						}
						this.settings.content.partials[partialName] = filePath;
					}
				}
			}

			// XML sitemap default
			Utils.assert(
				this.settings.content.xmlsitemap === false || typeof this.settings.content.xmlsitemap === 'object',
				'No configuration for XML site map.'
			);
			if (this.settings.content.xmlsitemap) {
				Utils.assert(this.settings.content.xmlsitemap.defaultPriority, 'No default priority for XML sitemap.');
				Utils.assert(this.settings.content.xmlsitemap.defaultChangeFrequency, 'No default change frequency for XML sitemap.');
			}

			// finalize configuration
			this.settings.content.input = this.utils.filterBuildPath(this.settings.content.input);
			let more = this.settings.content.watchMore ? this.settings.content.watchMore : [];
			if (typeof more === 'string') {
				more = [more];
			}
			this.settings.content.contentToWatch = this.utils.filterBuildPath(more.concat(this.settings.content.input));
			this.settings.content.input = this.utils.filterBuildPath(this.settings.content.input);
		});

		// Load path helper - this returns a promise, which will be waited upon at the end of Configuration.load()
		config.onLoad(() => {
			return new Promise((resolve) => {
				this._initBaseContext().then(() => {
					this._initHandlebars();
					this.pathHelper = new PathHelper(config, this.baseContext);
					resolve();
				});
			});
		});

		// finalize configuration
		config.onLoad(() => this._finalizeConfiguration());

		// we need to setup the htmlReplaceOptions at this point as it may have been affected
		// by the 'enable-release' task
		config.onChangeReleaseFlag(() => this._finalizeConfiguration())
	}

	/**
	 * Process templated contents
	 */
	processContents()
	{
		return gulp.src(this.settings.content.input)
			.pipe(plumber())
			.pipe((this.pathHelper.demuxProcessor())())
			.pipe((this._getTemplateProcessor())())
			.pipe((this._getHtmlProcessor())())
			.pipe(gulp.dest(this.settings.buildPath));
	}

	/**
	 * Lint templated contents
	 *
	 * NOTE: we lint the output, not the input. This is a bit strange and does not allow to directly
	 * refer to problems in source code, but independent contents/master may not make sense, so better
	 * to assess that the output is valid.
	 */
	lintContents()
	{
		return gulp.src(this.settings.content.input)
			.pipe((this.pathHelper.demuxProcessor())())
			.pipe((this._getTemplateProcessor())())
			.pipe((this._getLintHtmlProcessor())());
	}

	/**
	 * Extract i18n strings
	 */
	extractI18nStrings()
	{
		let input = [];
		input.push(this.settings.sourceRoot + 'masters/*.hbs');
		if (this.settings.content.partials) {
			for (let partialName in this.settings.content.partials) {
				if (this.settings.content.partials.hasOwnProperty(partialName)) {
					input.push(this.settings.content.partials[partialName]);
				}
			}
		}
		input = input.concat(this.settings.content.input);
		let extractedStrings = {};
		let p = new Promise((resolve) => {
			gulp.src(input)
				.pipe(plumber())
				.pipe(this.i18nHelper.extractI18nProcessor(extractedStrings)())
				.on('end', resolve);
		});
		return p.then(() => {
			return Utils.createEmptyStream(this.settings.i18n.source)
				.pipe(this.i18nHelper.buildI18nSourceFileProcessor(extractedStrings)())
				.pipe(gulp.dest('.'));
		});
	}

	/**
	 * Create a sitemap.xml out of the contents descriptions and sitemap
	 */
	generateXmlSitemap()
	{
		if (this.settings.content.xmlsitemap) {
			return Utils.createEmptyStream('sitemap.xml')
				.pipe(this.xmlSitemapHelper.getXmlSitemapProcessor(this.baseContext.contents)())
				.pipe(this._getXmlLicenseProcessor()())
				.pipe(gulp.dest(this.settings.buildPath));
		}
		else {
			return Promise.resolve();
		}
	}

	/**
	 * include CSS and JS into HTML
	 *
	 * @private
	 */
	_getHtmlReplaceProcessor()
	{
		return lazypipe()
		// replace dots in build ids with '_' (dots are not accepted by gulp-html-replace)
			.pipe(tap, (file) => {
				let input = file.contents.toString();
				input = input.replace(/<!--\s+build:([0-9a-zA-Z_.-]+)\s+-->/gm, (all, buildId) => {
					buildId = buildId.replace('.', '_');
					return `<!-- build:${buildId} -->`;
				});
				file.contents = new Buffer(input);
			})
			.pipe(htmlReplace, this.htmlReplaceOptions);
	}

	/**
	 * Insert license in HTML/XML content
	 *
	 * @private
	 */
	_getXmlLicenseProcessor()
	{
		return lazypipe()
			.pipe(tap,
				(file) => {
					if (this.settings.licenseTemplateFile && this.settings.isRelease) {
						// add the license
						let input = file.contents.toString();
						let l = this.utils.getLicense("<!--\n", "\n-->", ' * ', file);
						input = l + input;
						// the DOCTYPE or XML declaration may not be the first line anymore, so let's fix that.
						let docTypePattern = /(<!DOCTYPE[^>]+>|<\?xml.+?\?>)/m;
						let match = docTypePattern.exec(input);
						if (match) {
							if (!input.startsWith(match[1])) {
								input = match[1] + "\n" + input.replace(docTypePattern, '');
							}
						}
						file.contents = new Buffer(input);
					}
				}
			);
	}

	/**
	 * Get the pipe for processing HTML contents
	 *
	 * @private
	 */
	_getHtmlProcessor()
	{
		return lazypipe()
			.pipe(this.utils.runHooks('beforeHtmlRender'))
			// perform translations
			.pipe(this.i18nHelper.getI18nProcessor())
			// correct typography
			.pipe(this.typoHelper.getTypoProcessor())
			// include CSS and JS into HTML
			.pipe(this._getHtmlReplaceProcessor())
			// Correct paths
			.pipe(this.pathHelper.correctContentPathsProcessor())
			// minify content
			.pipe(
				() => {
					return gulpIf(
						(this.settings.isRelease) && (this.settings.content.minifyHtmlConfig !== false),
						htmlmin(require(this.settings.content.minifyHtmlConfig))
					);
				})
			// add license
			.pipe(this._getXmlLicenseProcessor())
			// and make the code pretty
			.pipe(
				() => {
					return gulpIf(
						!this.settings.isRelease,
						prettify({indent_char: '\t', indent_size: 1})
					);
				}
			)
			.pipe(this.utils.runHooks('afterHtmlRender'));
	};

	/**
	 * Get the pipe for linting HTML contents
	 *
	 * FIXME Does not work at all????
	 * @private
	 */
	_getLintHtmlProcessor()
	{
		return lazypipe()
			.pipe(this._getHtmlProcessor())
			.pipe(
				htmlhint,
				{
					htmlhintrc: this.settings.content.htmlLintConfig.startsWith('/')
						? this.settings.toolsRoot + this.settings.content.htmlLintConfig
						: this.settings.root + '/' + this.settings.content.htmlLintConfig
				}
			)
			.pipe(htmlhint.failReporter);
	}

	/**
	 * Process stream consisting of template contents (handlebars or markdown) and generate an HTML stream on its output.
	 *
	 * masters are always hbs files. Contents depend on the input filter, but are md or hbs by default.
	 */
	_getTemplateProcessor()
	{
		let _self = this;

		return lazypipe()
			.pipe(this.utils.runHooks('beforeApplyTemplate'))
			.pipe(through2, function (file, enc, cb) {
				let pipe = this;

				// Create a context that is relevant for the currently examined content
				// This context is based on the content configuration, and on the content of the base context$
				let contentConfig = _self.baseContext.contents[file.relative];
				if (!contentConfig) {
					Utils.die(`[content] [${file.relative}] No content context exists.`);
				}

				let contentContext = {
					currentPath: file.relative,
					menus: merge.recursive(true, {}, _self.baseContext.menus)
				};

				handlebars.Utils.extend(contentContext, contentConfig);

				// create submenus that are pertaining to this content
				let submenus = {};
				for (let menuName in contentContext.menus) {
					if (contentContext.menus.hasOwnProperty(menuName)) {
						let inputMenu = contentContext.menus[menuName];
						let level = 0;
						submenus[menuName] = [];
						let continueToNextLevel = true;
						while (continueToNextLevel) {
							continueToNextLevel = false;
							for (let i = 0; i < inputMenu.length; ++i) {
								if (inputMenu[i].children) {
									// FIXME submenus construction does not work. to be checked.
									if (_self._isPathInChildren(_self._getSourcePath(contentContext.currentPath), inputMenu[i].children)) {
										inputMenu = inputMenu[i].children;
										submenus[menuName]['level_' + (level + 1)] = inputMenu;
										continueToNextLevel = true;
										++level;
										break; // save only first encountered child for this level
									}
								}
							}
						}
					}
				}

				contentContext.menus.submenus = submenus;

				let content = file.contents.toString();
				content = _self._applyTemplateProcessing(contentConfig.reference, content, contentContext);

				contentContext.__content__ = content;

				// Then, if a master has been specified in the content configuration, render the inner content
				// within the master, which must also be instantiated (handlebars)
				let ret;
				if (contentConfig.master) {
					// select the master for this content
					let masterFile = path.resolve(_self.settings.sourceRoot + 'masters/' + contentConfig.master + '.hbs');

					// Add a partial to be used for rendering the content in masters
					// safe to render as-is, this is HTML at this point
					handlebars.registerPartial('content', '{{{__content__}}}');

					// generate the full document, based on the master
					// also possible to create a stream!
					let master = fs.readFileSync(masterFile, {encoding: 'utf-8'});
					let templateFullDoc = handlebars.compile(master);

					try {
						ret = templateFullDoc(contentContext);
					}
					catch (e) {
						Utils.warn(
							'content', contentConfig.reference, `Exception when rendering master template |${contentConfig.master}|.`,
							e
						);
					}
				}
				// If not master has been set, then the inner content is in fact the content of the whole document.
				else {
					ret = contentContext.__content__;
				}

				// save buffer and push the new version of the file to the stream and run the callback
				// (required, otherwise the stream will remain empty).
				file.contents = new Buffer(ret);
				pipe.push(file);
				cb();
			})
			.pipe(this.utils.runHooks('afterApplyTemplate'));
	}


	/**
	 * Initialize the base context: it will serve as the basis for populating data into contents.
	 *
	 * We parse all contents, and retrieve title, shortTitle and path information.
	 *
	 * @private
	 */
	_initBaseContext()
	{
		// template context creation
		let baseCtx = {
			contents: {}, // filled later in promise below
			menus: ContentsHandler._genMenus(this.settings.content.sitemap)
		};

		// get information about contents
		// the keys of the baseContent.contents array are the paths for accessing the content. We store the same
		// information to both the original path and the target paths
		return new Promise(
			(resolve) => {
				gulp.src(this.settings.content.input)
					.on('end',
						() => {
							this.baseContext = baseCtx;
							Object.freeze(this.baseContext);
							resolve(baseCtx);
						}
					)
					.pipe(plumber())
					.pipe(through2(
						(file, enc, cb) => {
							let conf = this._acquireYamlConfig(file);

							// template for the content context
							// the different variables set into the content context will be available
							// within handlebars contents
							let contentProperties = {
								// path of source (original) file
								reference: conf.originalPath,
								// path of the generated output. If set to false, then the content is
								// only a source content and generated output will be described in other entries
								// of the contents context
								target: false,
								// object containing key-value pairs of translations for this content
								// key: language code, value: path to generated output in that language
								translationSet: conf.path,

								// title of the content
								title: conf.title,
								// short title of the content
								shortTitle: conf.shortTitle,
								// master file name, or false
								master: conf.master,
								// xml sitemap information
								xmlsitemap: conf.xmlsitemap,
								// more variables
								more: conf.more,
								// canonical url to the content
								canonicalUrl: false,
								// language of the content
								lang: false,
								// root URL as defined in configuration file
								rootUrl: this.settings.rootUrl
							};

							// add reference element to our contents
							// the key is equal to 'reference'
							baseCtx.contents[conf.originalPath] = contentProperties;

							for (let lang in conf.path) {
								if (conf.path.hasOwnProperty(lang)) {
									let newProperties = {
										canonicalUrl: PathHelper.getPathWithoutDirectoryIndex(
											this.settings.rootUrl + '/' + conf.path[lang],
											this.settings.content.directoryIndexPattern
										),
										lang: lang,

										target: conf.path[lang],
									};
									// add this target element to our contents
									// we may overwrite an already set reference element, but that's ok. In this
									// case the new element will be both a reference and a target at the same time
									// the key is equal to 'target'
									baseCtx.contents[conf.path[lang]] = Object.assign({}, contentProperties, newProperties);
								}
							}

							cb();
						}
					));
			}
		);
	}


	/**
	 * Initialize our handlebars logic (helpers, partials)
	 *
	 * @private
	 */
	_initHandlebars()
	{
		let _self = this;

		// passthrough without typo improvements
		handlebars.registerHelper('passthrough', function (str) {
			return new handlebars.SafeString(
				'<no-typo>' + str + '</no-typo>'
			);
		});

		// remove html tags
		handlebars.registerHelper('stripHtml', function (str) {
			return str.replace(/<([^>]+)>/g, "");
		});

		// concat strings
		handlebars.registerHelper('concat', (...args) => args.slice(0, -1).join(''));

		// Helper to render raw structures as their JSON representation
		handlebars.registerHelper('json', function (obj) {
			return new handlebars.SafeString(
				'<no-typo><pre>'
				+ JSON.stringify(obj, null, 2)
				+ '</pre></no-typo>'
			);
		});

		// translate a string
		handlebars.registerHelper('i18n',
			function (what) {
				return _self.i18nHelper.getTranslationOrWarn(what, this.lang, this.reference);
			}
		);

		// Handlebars helper: get the path for the specified path, in the target language specified as an option
		// No need for passing a context.
		//
		// The passed path can also be a target path, but we rather should refer to reference paths, which is
		// easier to maintain.
		//
		// If we request a path to a non-existing language, then we may have broken links.
		//
		// Examples:
		// {{get-path "content-plain-html-multilang-paths.html"}}
		// {{get-path "content-plain-html-multilang-paths.html" lang="de"}}
		handlebars.registerHelper('get-path',
			(path, options) => {
				// language: if not specified, use the language of the currently processed content
				let targetLang =
					(options.hash.lang ? handlebars.escapeExpression(options.hash.lang) : this.lang)
					|| this.settings.i18n.fallbackLanguage;
				let canonical = !!options.hash.canonical;

				if (this.baseContext.contents[path]
					&& this.baseContext.contents[path].translationSet
					&& this.baseContext.contents[path].translationSet[targetLang]
				) {
					if (canonical) {
						let t = this.baseContext.contents[path].translationSet[targetLang];
						return this.baseContext.contents[t].canonicalUrl;
					}
					else {
						return this.baseContext.contents[path].translationSet[targetLang].replace(/^\//, '');

					}
				}
				Utils.warn('content', path, `Could not find path for lang=|${targetLang}|`);
				return path;
			}
		);

		// Get a language label. The requested language is given in its short form (e.g. 'fr') and its native label
		// is returned by default. The 'style' parameter can be either 'native', 'current' and 'short'. If a 'context'
		// parameter is passed, it should be set to the content context of the currently processed content.
		handlebars.registerHelper('get-language-label',
			function (requestedLanguage, options) {
				let style = options.hash.style ? options.hash.style : 'native';
				let context = options.hash.context ? options.hash.context : this;
				let currentLanguage = context.lang ? context.lang : _self.settings.i18n.fallbackLanguage;

				//noinspection FallThroughInSwitchStatementJS
				switch (style) {
					case 'short':
						return requestedLanguage;
					case 'native':
						// no break
						currentLanguage = requestedLanguage;
					case 'current':
						if (!_self.settings.i18n.labels[requestedLanguage]
							|| !_self.settings.i18n.labels[requestedLanguage][currentLanguage]
						) {
							throw `Undefined language in reference array: |${requestedLanguage}| (requested in current language: |${currentLanguage}|).`;
						}
						return _self.settings.i18n.labels[requestedLanguage][currentLanguage];
					default:
						throw `Invalid style |${style}|`;
				}
			}
		);

		// Loop over the languages of a specific content.
		// This is used by the language-switcher.hbs partial
		//
		// We can also pass a target path to this function, but it is better practice to
		// provide it with a source path
		handlebars.registerHelper('foreach-language',
			function (path, options) {
				let languages = [];
				let context = this;
				if (context.translationSet) {
					for (let lang in context.translationSet) {
						if (context.translationSet.hasOwnProperty(lang)) {
							languages.push(lang);
						}
					}
				}
				else {
					throw `Cannot find content definition for content |${path}|`;
				}

				let ret = '';
				for (let i = 0; i < languages.length; i++) {
					ret = ret + options.fn({
						lang: languages[i],
						first: i === 0,
						last: (i === languages.length - 1),
						classes: context.classes
					});
				}
				return ret;
			}
		);

		// Get the title of a content, identified by its source path.
		// If the 'short' parameter is set to true, the short title is rendered.
		// We do not need to set a context for this helper to work
		//
		// We can also pass a target path to this function, but it is better practice to
		// provide it with a source path
		handlebars.registerHelper('get-title',
			(path, options) => {
				let context = this.baseContext.contents[path];
				let short = !!options.hash.short;
				let ret;
				if (!context || !context.title) {
					Utils.warn('content', path, `No title defined.`);
					ret = '<span class="debug error error-no-title-defined">' + path + '</span>';
				}
				else {
					ret = short ? context.shortTitle : context.title;
				}
				return new handlebars.SafeString(ret);
			}
		);

		// Get helper class names for menu items
		// Used by menu.hbs partial
		handlebars.registerHelper('get-menu-item-classes',
			(isFirst, isLast, currentPath, itemPath, children) => {
				currentPath = this._getSourcePath(currentPath);

				let classes = [];
				if (isFirst) {
					classes.push('first');
				}
				if (isLast) {
					classes.push('last');
				}
				if (currentPath === itemPath) {
					classes.push('active');
				}
				if (children) {
					if (this._isPathInChildren(currentPath, children)) {
						classes.push('active-trail');
					}
				}
				return new handlebars.SafeString(classes.length ? ' class="' + classes.join(' ') + '"' : '');
			}
		);

		// Tells whether we must expand the menu
		// Used by menu.hbs partial
		handlebars.registerHelper('if-must-expand-menu',
			function (expandPolicy, children, currentPath, currentItemId, options) {
				currentPath = _self._getSourcePath(currentPath);

				if (!children) {
					return options.inverse(this);
				}
				expandPolicy = expandPolicy ? expandPolicy : 'always';
				switch (expandPolicy) {
					case 'never':
						return options.inverse(this);
					case 'activeTrail':
						if (currentPath === currentItemId || _self._isPathInChildren(currentPath, children)) {
							return options.fn(this);
						}
						else {
							return options.inverse(this);
						}
					case 'always':
						return options.fn(this);
				}
			}
		);

		// helpers to compare two values
		handlebars.registerHelper('if-equal', function(a, b, options) {
			return a === b ? options.fn(this) : options.inverse(this);
		});

		handlebars.registerHelper('unless-equal', function(a, b, options) {
			return a !== b ? options.fn(this) : options.inverse(this);
		});

		// Helper to include files
		handlebars.registerHelper('include-file', function (file, options) {
			// files with path starting with / are relative to the toolsRoot.
			// Others are relative to the this.settings.root
			if (file.startsWith('/')) {
				file = _self.settings.toolsRoot + file;
			}
			else {
				file = _self.settings.sourceRoot + '/' + file;
			}

			let ret;
			try {
				ret = fs.readFileSync(file, {encoding: 'utf-8'});
			}
			catch (e) {
				throw `Cannot read include file |${file}|`;
			}

			let context = {...this};
			Object.assign(context.more, options.hash);

			// if we have a handlebar file, do compile and template the content
			// such that the current context (this) can be used in the included file
			ret = _self._applyTemplateProcessing(file, ret, context);
			return new handlebars.SafeString(ret);
		});

		// register partials
		// NOTE: partials are just strings. they NEVER contain something generated at runtime
		for (let partialName in this.settings.content.partials) {
			if (this.settings.content.partials.hasOwnProperty(partialName)) {
				let filePath = this.settings.content.partials[partialName];
				let partial;
				try {
					partial = fs.readFileSync(filePath, {encoding: 'utf-8'});
				}
				catch (e) {
					throw `Cannot read partial |${filePath}|`;
				}
				handlebars.registerPartial(partialName, partial);
			}
		}
	}

	/**
	 * Apply template processing functions to file, which contains 'content' content. Use the provided context for
	 * variable interpolation
	 *
	 * @param file
	 * @param content
	 * @param context
	 * @returns {*}
	 * @private
	 */
	_applyTemplateProcessing(file, content, context)
	{
		if (file.endsWith('.hbs')) {
			let templateContent = handlebars.compile(content);
			// create a partial for the content
			try {
				content = templateContent(context);
			}
			catch (e) {
				Utils.warn('content', `Exception when rendering content template.`, e);
			}
		}
		else {
			if (file.endsWith('.md')) {
				marked.setOptions({
					sanitize: false
				});
				content = marked(content);
			}
			// other file types, e.g. plain HTML

			// fake handlebars processor
			// replace some of the values we have in the content context, but do not run a real
			// handlebars processor as it may be dangerous ??? - but it would make all features availalble
			// into HTML/md files too. Is this something we want? FIXME not sure... to be thought of.
			/*
			 let templateContent = handlebars.compile(content);
			 try {
			 content = templateContent(contentContext);
			 }
			 catch (e) {
			 Utils.warn('content', `[${contentConfig.reference}] Exception when rendering content template (HTML/md).`, e);
			 }
			 */
			content = content.replace(/\{\{title}}/g, context.title)
				.replace(/\{\{shortTitle}}/g, context.shortTitle)
				.replace(/\{\{rootUrl}}/g, context.rootUrl)
				.replace(/\{\{canonicalUrl}}/g, context.canonicalUrl)
				.replace(/\{\{lang}}/g, context.lang);
		}
		return content;
	}

	/**
	 * Tells whether the provided path is part of the provided menu children (any depth)
	 *
	 * The input path is a source path
	 *
	 * @private
	 */
	_isPathInChildren(path, children)
	{
		for (let i = 0; i < children.length; ++i) {
			if (children[i].id === path) {
				return true;
			}
			if (children[i].children) {
				let res = this._isPathInChildren(path, children[i].children);
				if (res) {
					return res;
				}
			}
		}
		return false;
	}

	/**
	 * Convert any path to a source path, i.e. the path of the source file
	 *
	 * If no path can be found, return the path as-is
	 *
	 * @private
	 */
	_getSourcePath(path)
	{
		if (!this.baseContext.contents[path]) {
			return path;
		}
		return this.baseContext.contents[path].reference;
	}

	/**
	 * Parse content header and retrieve in-file YAML per-content configuration.
	 *
	 * Retrieve:
	 * - the title, which defaults to file.relative if absent
	 * - the shortTitle, which defaults to title if absent
	 * - path, which is an absolute path in the context of the application, and can be either a string (one language)
	 *   or an array in the case where we have more than one language. In the later case, the array key is the language
	 *   specifier (e.g. 'fr')
	 * - xmlsitemap: frequency and priority information
	 * - more: other variables to expose to content templating system
	 *
	 *
	 * @private
	 */
	_acquireYamlConfig(file)
	{
		// storing files in subdirectories would break our path fixing feature. So let's not do it.
		// perhaps we may relax that in the future. To be checked.
		if (/\//.test(file.relative)) {
			throw `Error processing file |${file.relative}|: cannot be stored in subdirectory of |contents/|`;
		}

		// originalPath always starts with /
		let resultConfig = {
			originalPath: file.relative,
		};

		let yamlDelimiterPattern = /start-content-config.*([^]*?).*end-content-config/m;
		let match = yamlDelimiterPattern.exec(file.contents.toString());

		let conf = {};
		if (match) {
			// replace tabs with spaces as YAML does not support tabs
			// (but I don't like spaces in my editors)
			conf = YAML.parse(match[1].replace(/\t/g, ' '));
			if (!conf) {
				throw `Cannot parse YAML configuration in |${file.relative}|.`;
			}
		}

		// If no path is set AND if this is a handlebars template, then change the extension to .html
		if (!conf.path) {
			conf.path = '/' + resultConfig.originalPath.replace(/\.(hbs|md)$/, '.html');
		}

		// transform into an array if a single path has been provided.
		// Auto-detect the language or fallback the default language.
		if (typeof conf.path === 'string') {
			let lang = this.i18nHelper.autoDetectLanguage(file) || this.settings.i18n.fallbackLanguage;
			let tmp = {};
			tmp[lang] = conf.path;
			conf.path = tmp;
		}

		// check if the path is indeed absolute (starts with /)
		for (let lang in conf.path) {
			if (conf.path.hasOwnProperty(lang)) {
				if (!conf.path[lang].startsWith('/')) {
					throw `Path |${conf.path[lang]}| does not start with / in |${resultConfig.originalPath}|.`;
				}
				conf.path[lang] = conf.path[lang].replace(new RegExp("^/"), '');
			}
		}

		if (!conf.title) {
			conf.tilte = resultConfig.originalPath;
		}
		if (!conf.shortTitle) {
			conf.shortTitle = conf.title;
		}

		if (!conf.more) {
			conf.more = [];
		}

		if (!conf.xmlsitemap) {
			conf.xmlsitemap = [];
		}

		// merge result with contentConfig.
		handlebars.Utils.extend(resultConfig, conf);

		return resultConfig;
	}


	/**
	 * Generate the menus, based on the provided sitemap
	 *
	 * @private
	 */
	static _genMenus(items)
	{
		let res = {};
		for (let menuName in items) {
			if (items.hasOwnProperty(menuName)) {
				res[menuName] = [];
				// array
				items[menuName].forEach((item) => {
					if (typeof item === 'string') {
						// ok, simple node.
						res[menuName].push({id: item});
					}
					else { // object. first key is menu item, its content is new menu
						let tmp = Object.keys(item)[0];
						let subMenu = ContentsHandler._genMenus(item);
						item = tmp;
						res[menuName].push({id: item, children: subMenu[item]});
					}
				})
			}
		}
		return res;
	}

	/**
	 * Finalize configuration before processing.
	 *
	 * @private
	 */
	_finalizeConfiguration()
	{
		this.htmlReplaceOptions = {};
		for (let s in this.settings.htmlReplaceConfig) {
			if (this.settings.htmlReplaceConfig.hasOwnProperty(s)) {
				// '.' is NOT allowed in the replace identifier. So let's replace non valid chars with '_'
				// However we can still use dots in the source contents because we correct these ids later
				// in _getHtmlReplaceProcessor()
				let sid = s.replace(/[^a-z0-9_-]/i, '_');
				this.htmlReplaceOptions[sid] = {
					src: this.settings.htmlReplaceConfig[s]
				};
				if (s.endsWith('.js')) {
					this.htmlReplaceOptions[sid].tpl = '<script src="../%s"></script>';
				}
				else if (s.endsWith('.css')) {
					this.htmlReplaceOptions[sid].tpl = '<link href="../%s" rel="stylesheet" />';
				}
				else {
					Utils.assert(false, `Provided |${s}| set is not either JavaScript or CSS`);
				}
			}
		}
		return Promise.resolve();
	}
}

/**
 * Export module
 *
 * @type {ContentsHandler}
 */
module.exports = ContentsHandler;

/**
 * Website generator v2 - Utils.js
 */

'use strict';

/**
 * Load module dependencies
 */
const lazypipe = require('lazypipe');
const stream = require('stream');
const gutil = require('gulp-util');
const noop = gutil.noop;
const handlebars = require('handlebars');

/**
 * Hooks that are not lazypipes
 * We will implement these hooks as chained Promises
 */
const promisesHooks = [
	'beforeCleanBuildDir',
	'afterCleanBuildDir',
	'beforeConfigurationLoading',
	'afterConfigurationLoading'
];

/**
 * Minimum time between browser reloads
 */
const BROWSER_RELOAD_FREQUENCY = 800;

/**
 * Module providing utilities.
 */
class Utils {

	/**
	 * Constructor
	 *
	 * @param config
	 */
	constructor(config)
	{
		this.settings = config.settings;
		this.promisesHooks = promisesHooks;
		this.reloadTimeoutId = false;
	}

	/**
	 * Omit build target from build path
	 *
	 * If the build path and source path are siblings (i.e. source path does not contain build path)
	 * then we should not have problems, but we still add the build targets as a negative input filter
	 * to be safe
	 */
	filterBuildPath(input)
	{
		/*
		 foreach input, if starts with / or !/, leave as is
		 if starts with ! remove !, convert to absolute, put ! back
		 else convert to absolute
		 */
		input = input.map((v) =>
		{
			let isNegation = false;
			if (v.indexOf('!') === 0) {
				isNegation = true;
				v = v.substr(1);
			}
			if (v.indexOf('/') !== 0) {
				v = this.settings.sourceRoot + v;
			}
			if (isNegation) {
				v = `!${v}`;
			}
			return v;
		});
		input.push(
			`!${this.settings.sourceRoot}build-dev/**`,
			`!${this.settings.sourceRoot}${this.settings.appName}-*/**`
		);
		return input;
	}

	/**
	 * Get the license formatted such that it is ready to be included in another file.
	 */
	getLicense(prefix, suffix, linePrefix, file)
	{
		if (!this.settings.licenseText) {
			return '';
		}

		prefix = prefix ? prefix : '';
		suffix = suffix ? suffix : '';
		linePrefix = linePrefix ? linePrefix : '';

		let lic = prefix +
			this.settings.licenseText
				.split("\n")
				.map((value) =>
				{
					return linePrefix + value;
				})
				.join("\n") + suffix;

		let licenseTemplate = handlebars.compile(lic);
		let res;
		try {
			res = licenseTemplate({
				app: this.getExposedAppVariables(),
				file: file
			});
		}
		catch (e) {
			throw e;
		}
		return res;
	};

	/**
	 * Run all instances of a hook
	 *
	 * This function returns a lazypipe or a function, that may need to be called:
	 * ret() -> execute operations
	 */
	runHooks(name, ...args)
	{
		let isLazyPipe = this.promisesHooks.indexOf(name) === -1;
		let ret;
		let initialResolve = null;
		let currentPromise;
		if (isLazyPipe) {
			ret = lazypipe()
				.pipe(noop);
		}
		else {
			ret = new Promise((resolve) =>
			{
				initialResolve = resolve;
			});
			currentPromise = ret;
		}
		for (let i = 0; i < this.settings.hooks.length; ++i) {
			if (this.settings.hooks[i][name] && typeof this.settings.hooks[i][name] === 'function') {
				let f = this.settings.hooks[i][name];
				if (isLazyPipe) {
					ret = ret.pipe(f(args));
				}
				else {
					currentPromise = currentPromise
						.then((prevRet) =>
						{
							// if the hook returns a Promise, wait for its completion before continuing
							if (prevRet && prevRet.then) {
								return prevRet.then(() =>
								{
									return f(args);
								})
							}
							else {
								return f(args);
							}
						});
				}
			}
		}

		if (isLazyPipe) {
			return ret;
		}
		else {
			return () =>
			{
				initialResolve();
				return ret;
			};
		}
	}

	/**
	 * Reload the browser, but do so only if no change has been detected for BROWSER_RELOAD_FREQUENCY
	 */
	reloadBrowserOnChange()
	{
		if (this.reloadTimeoutId) {
			clearTimeout(this.reloadTimeoutId)
		}
		this.reloadTimeoutId = setTimeout(() =>
		{
			this.settings.browserSync.instance.reload();
		}, BROWSER_RELOAD_FREQUENCY);
	}

	/**
	 * Do the same operation on all sets of provided as the input
	 *
	 * Return a promise.
	 *
	 * This function f takes the input file matchers, output file name and watch matchers as parameters.
	 * The watcher matchers are not likely to be used by the processing function but will be used by the
	 * gulp task creating watches.
	 *
	 * The function f can return a promise, and this function returns a
	 * promise on all promises returned by f's. If no promise is returned
	 * by f, then the global promise will resolve immediately.
	 */
	static doOnAllSets(sets, f)
	{
		let promises = [];
		for (let s in sets) {
			if (sets.hasOwnProperty(s)) {
				sets[s].output = s;
				let p = f(sets[s]);
				if (p && p.then) {
					promises.push(p);
				}
			}
		}
		return Promise.all(promises);
	}

	/**
	 * Negate all provided paths by prepending a !
	 */
	static negatePaths(paths)
	{
		return paths.map(p => '!' + p);
	}

	/**
	 * Kill the running process after having displayed an error message.
	 */
	static die(errorMessage)
	{
		throw new gutil.PluginError(
			require(__dirname + '/../package.json').name,
			errorMessage
		);
	}

	/**
	 * Raise a warning
	 */
	static warn(...messages)
	{
		let last = messages.pop();
		if (last.replace) {
			last = last.replace(/\|([^|]*?)\|/g, function (all, content)
			{
				return '|' + gutil.colors.blue(content) + '|';
			});
		}
		else {
			gutil.log('raw message: ', last);
			last = '';
		}
		messages = messages.map((m) => '[' + gutil.colors.magenta(m) + ']');
		gutil.log(gutil.colors.yellow('WARNING'), ...messages, last);
	}

	/**
	 * Trigger an exception if the provided assertion is not verified.
	 *
	 * @param assert
	 * @param msg
	 */
	static assert(assert, msg)
	{
		if (!assert) {
			Utils.die(new Error(msg).stack);
		}
	}


	/**
	 * Create a stream consisting of an empty file with the specified filename
	 *
	 * @param filename
	 */
	static createEmptyStream(filename)
	{
		let src = stream.Readable({objectMode: true});
		src._read = function ()
		{
			this.push(new gutil.File({
				cwd: "",
				base: "",
				path: filename,
				contents: new Buffer('')
			}));
			this.push(null)
		};
		return src;
	}


	/**
	 * Get variables from settings that are acceptable as being exposed
	 * This function is to be called at the time of usage of the variables, 
	 * as some variables may be changed after initial configuration 
	 * (for now only isRelease has this behavior)
	 */
	getExposedAppVariables()
	{
		const toKeep = [
			'author',
			'isRelease',
			'buildDateTime',
			'buildUser',
			'rootUrl',
			'appName',
			'appVersion',
			'generatorName',
			'generatorVersion'
		];
		let appVars = {};
		toKeep.forEach((v) => {
			appVars[v] = typeof this.settings[v] !== 'undefined' ? this.settings[v] : '';
		});
		return appVars;
	}
}

/**
 * Module export
 *
 * @type {Utils}
 */
module.exports = Utils;

/**
 * Website generator v2 - Configuration.js
 */

'use strict';

/**
 * Load module dependencies
 */
const fs = require('fs');
const YAML = require('yamljs');
const path = require('path');
const handlebars = require('handlebars');
const merge = require('merge');
const glob = require('glob');
const crypto = require('crypto');
const browserSync = require('browser-sync');
const Utils = require('./Utils');

/**
 * Configuration object.
 */
class Configuration {

	/**
	 * Constructor
	 */
	constructor()
	{
		this.isLoaded = false;
		this.settings = {};
		this.source = '';
		this.toCallOnLoad = [];
		this.toCallOnReleaseFlagChange = [];
	}

	/**
	 * Add a callback to be run at the end of the configuration loading.
	 *
	 * Any operation performed in these methods is done in the webgen tool directory (e.g. Gulpfile.js' directory)
	 * so if one wants to access the project directory, he can use this.settings.root, which is already available
	 * at this stage.
	 *
	 * @param callback
	 */
	onLoad(callback)
	{
		if (this.isLoaded) {
			throw 'Error: cannot register onLoad() callback if configuration object is already being loaded.';
		}
		this.toCallOnLoad.push(callback);
	}

	/**
	 * Add callback to be run when we change the release flag
	 */
	onChangeReleaseFlag(callback)
	{
		if (this.isLoaded) {
			throw 'Error: cannot register onChangeReleaseFlag() callback if configuration object is already being loaded.';
		}
		this.toCallOnReleaseFlagChange.push(callback);
	}

	/**
	 * Acquire the configuration file and process the static configuration obtained from the merging of the default
	 * configuration and from this file, and then prepare an augmented configuration object, i.e. with values depending
	 * on the current state of the project, and information being made easily accessible by the calling modules.
	 *
	 * Default values are defined in config.default.yaml
	 *
	 * All paths are absolutely resolved. Directories all end with /
	 *
	 * Everything that must be used by other modules is stored in the this.settings object. Parameters that
	 * are only used internally are stored as instance variables in the different modules where there are used.
	 */
	load()
	{
		if (this.isLoaded) {
			return;
		}

		// get the YAML file
		this.source = Configuration._guessConfigurationFile();
		if (!this.source) {
			throw 'No YAML configuration option set or found.';
		}
		this.source = path.resolve(this.source);

		if (!this.source) {
			throw 'No YAML configuration file found.';
		}

		// Get the default configuration
		let defaultInput;
		try {
			defaultInput = fs.readFileSync(path.resolve(__dirname + '/../config.default.yaml'), {encoding: 'utf8'});
		}
		catch (e) {
			throw 'Cannot acquire default config file';
		}

		// replace tabs by spaces (bad habits die hard)
		let defaultConf = YAML.parse(defaultInput.replace(/\t/gm, ' '));

		// get static, user-defined configuration
		let input;

		try {
			input = fs.readFileSync(this.source, {encoding: 'utf8'});
			// tab to space conversion
			input = input.replace(/\t/gm, ' ');
		}
		catch (e) {
			// file not found,  not readable, etc.
			throw `Problem reading file |${this.source}|`;
		}

		// acquire custom configuration file and set its root
		let customConf = YAML.parse(input) || {};
		customConf.root = path.resolve(process.cwd(), path.dirname(this.source)) + '/';

		// import package.json (if exists)
		let pkg;
		try {
			pkg = require(customConf.root + 'package.json');
		}
		catch (err) {
			pkg = {}
		}

		// some fields are mandatory
		if (!pkg.name && !customConf.appName) {
			throw 'Missing configuration: pkg.name (package.json) or <custommConf>.appName (webgen.yaml)';
		}
		if (!pkg.version && !customConf.appVersion) {
			throw 'Missing configuration: pkg.version (package.json) or <customConf>.appVersion (webgen.yaml)';
		}

		// merge default and custom configs
		customConf = merge.recursive(true, defaultConf, customConf);

		// different roots:
		// .root: the directory where we find the configuration file
		customConf.root = path.resolve(customConf.root) + '/';
		// .sourceRoot: directory where we chdir() and that acts as the root of project sources
		customConf.sourceRoot = path.resolve(customConf.root + (customConf.sourcePathRoot || '/')) + '/';
		// .toolsRoot: the directory that contains the webgen tool (i.e. the parent directory of this file)
		customConf.toolsRoot = path.resolve(__dirname + '/..') + '/';
		// .rootUrl: the url used as the web root. Useful for canonical urls, for example
		customConf.rootUrl = customConf.rootUrl || 'http://localhost';
		customConf.isRelease = false;
		customConf.appName = pkg.name ? pkg.name : customConf.appName;
		customConf.appVersion = pkg.version ? pkg.version : customConf.appVersion;
		customConf.author = pkg.author ? pkg.author : customConf.author;
		customConf.buildDateTime = new Date().toISOString().slice(0, -5) + 'Z';
		customConf.buildUser = process.env['USER'];
		customConf.buildRandomNumber = 'dev-' + new Date().getTime() + '-' + Math.floor((Math.random() * 1000) + 1);

		// some files might not be monitored, so let's create a new file pattern to enable watching them
		customConf.additionallyWatchedFiles = [];
		customConf.additionallyWatchedFiles.push(customConf.sourceRoot + 'masters/*.hbs');
		if (customConf.i18n.source) {
			customConf.i18n.source = customConf.root + customConf.i18n.source;
			customConf.additionallyWatchedFiles.push(customConf.i18n.source);
		}

		// check if we have a bowerrc file and if we put components in a custom directory
		let bowerConfig;
		try {
			// we cannot simply require() the json file as require() relies on the file extension
			bowerConfig = JSON.parse(fs.readFileSync(customConf.root + '.bowerrc', "utf8"));
		}
		catch (err) {
			bowerConfig = {}
		}
		customConf.bowerComponentsPath = customConf.root + (bowerConfig.directory || 'bower_components');

		// we must wait for the configuration object to be ready before finalizing configuration
		this.onLoad(() =>
		{
			this.utils = new Utils(this);
			this.settings.additionallyWatchedFiles = this.utils.filterBuildPath(this.settings.additionallyWatchedFiles);
		});

		// get the license text if it exits
		if (customConf.licenseTemplateFile) {
			customConf.licenseText = fs.readFileSync(path.resolve(customConf.sourceRoot + customConf.licenseTemplateFile)).toString();
		}

		// Some paths are relative to a hard-coded path, so let's make them relative to the root
		customConf.content.input.map(
			(v, i) =>
			{
				customConf.content.input[i] = customConf.sourceRoot + 'contents/' + v;
			}
		);

		// init a browser-sync instance
		if (customConf.browserSync) {
			customConf.browserSync = {
				config: customConf.browserSync
			};
		}
		else {
			customConf.browserSync = {
				config: {
					// will be set in _adaptBuildTarget()
					server: customConf.browserSync !== false
				}
			};
		}
		customConf.browserSync.instance = browserSync.create(customConf.buildRandomNumber);

		// setup hooks
		this.onLoad(() =>
		{
			if (this.settings.hooks) {
				if (!Array.isArray(this.settings.hooks)) {
					this.settings.hooks = [this.settings.hooks];
				}
				this.settings.hooks =
					this.settings.hooks
						.map((c) =>
						{
							let f = this.settings.toolsRoot;
							if (!c.startsWith('/')) {
								f = this.settings.sourceRoot;
							}
							f = f + c;
							if (fs.existsSync(f)) {
								let hook = require(f);
								if (Object.getOwnPropertyNames(hook).length > 0) {
									return hook;
								}
							}
							Utils.warn(hook, c, 'Not valid (non existing file or not a valid object?).');
							return null;
						})
						.filter((item) => item !== null);
			}
			else {
				this.settings.hooks = [];
			}
		});

		// save the result, without changing the object reference
		Object.assign(this.settings, customConf);

		// setup build targets
		this._adaptBuildTarget();

		// check that our common configuration elements are ok
		this._assertCommonConfig();

		return this._callOnLoad();
	};


	/**
	 * Check common configuration elements
	 */
	_assertCommonConfig()
	{
		Utils.assert(this.settings.rootUrl, 'No root URL.');
		Utils.assert(this.settings.root, 'No project root.');
		Utils.assert(this.settings.sourceRoot, 'No source root.');
		Utils.assert(this.settings.toolsRoot, 'No tools root.');
		Utils.assert(this.settings.buildPath, 'Build path is not set.');
		Utils.assert(this.settings.isRelease === false, 'Release flag not set to false (it may be altered later).');
		Utils.assert(this.settings.browserSync, 'No BrowserSync configuration');
		Utils.assert(this.settings.browserSync.instance.stream(), 'No BrowserSync stream available.');
		Utils.assert(this.settings.buildAssetsSuffix !== undefined, 'No build suffix defined.');
		Utils.assert(this.settings.bowerComponentsPath !== undefined, 'No bower components path.');
	}

	/**
	 * Call callbacks that were registered with onLoad()
	 *
	 * @private
	 */
	_callOnLoad()
	{
		let promises = [];
		for (let c of this.toCallOnLoad) {
			let r = c();
			if (r && r.then) {
				promises.push(r);
			}
		}
		return new Promise((resolve) =>
		{
			Promise.all(promises)
				.then(() =>
				{
					// hooks for end of configuration
					return this.utils.runHooks('afterConfigurationLoading', this.settings)();
				})
				.then(() =>
				{
					// mark configuration as loaded
					this.isLoaded = true;

					// do not allow further modification of the configuration
					// after initial loading
					Object.freeze(this);

					resolve();
				});
		});
	}

	/**
	 * Call callbacks after release flag change
	 */
	_callOnReleaseFlagChange()
	{
		let promises = [];
		for (let c of this.toCallOnReleaseFlagChange) {
			let r = c();
			if (r && r.then) {
				promises.push(r);
			}
		}
		return new Promise((resolve) =>
		{
			Promise.all(promises)
				.then(() =>
				{
					resolve();
				})
		});
	}

	/**
	 * Enable release mode, and adapt configuration parameters accordingly
	 */
	enableReleaseMode()
	{
		this.settings.isRelease = true;

		this._adaptBuildTarget();

		console.log('enable log');
		return this._callOnReleaseFlagChange();
	}

	/**
	 * Set the build path and other related build target configurations. This logic depends on the
	 * value of the this.settings.isRelease flag
	 *
	 * @private
	 */
	_adaptBuildTarget()
	{
		if (this.settings.isRelease) {
			let releaseSuffix =
				new Buffer(
					crypto.createHash('sha1')
						.update(this.settings.appVersion)
						.digest('hex')
				)
					.toString('base64')
					.substr(0, 8);
			this.settings.buildAssetsSuffix = '.' + releaseSuffix + '.min';
			this.settings.buildPath = path.resolve(
				this.settings.root
				+ this.settings.buildPathRoot
				+ '/' + this.settings.appName + '-' + this.settings.appVersion + '/'
			);
		}
		else {
			this.settings.buildAssetsSuffix = '.' + this.settings.buildRandomNumber;
			// .buildPath: directory where we generate the output
			this.settings.buildPath = path.resolve(
				this.settings.root
				+ this.settings.buildPathRoot
				+ './build-dev/'
			);
		}

		// let the system know which CSS and JS files must be included in HTML
		this.settings.htmlReplaceConfig = {};
		['styles', 'scripts'].forEach(
			(what) =>
			{
				let sets = this.settings[what].sets;

				for (let set in sets) {
					if (sets.hasOwnProperty(set)) {
						this.settings.htmlReplaceConfig[set] =
							set.replace(/(\.[^.]+)$/, this.settings.buildAssetsSuffix + '$1');
					}
				}
			}
		);

		// update browserSync server
		if (this.settings.browserSync
			&& this.settings.browserSync.config
			&& this.settings.browserSync.config.server
		) {
			this.settings.browserSync.config.server = this.settings.buildPath;
		}
	}

	/**
	 * Get the configuration file, either by using the one given as a command line param,
	 * or by discovering it in ../webgen.yaml or ../<star>/webgen.yaml
	 *
	 * @private
	 */
	static _guessConfigurationFile()
	{
		// either comes from command line or from WEBGEN_CONFIG
		const configParam = require('minimist')(process.argv.slice(2)).config || process.env.WEBGEN_CONFIG;

		if (configParam) {
			return configParam;
		}
		else {
			// discover file. Paths relative to gulpfile
			let found = glob.sync('./**/webgen.yaml', {ignore: './node_modules/**/*'});
			if (found.length) {
				if (found.length > 1) {
					Utils.warn('Configuration', 'We tried to detect webgen.yaml in upper directories but we found more than one.');
					return null;
				}
				else {
					return found[0];
				}
			}
		}

	}

}

/**
 * Module export
 */
module.exports = Configuration;


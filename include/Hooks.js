/**
 * Website generator v2 - Hooks.js
 */

'use strict';

/**
 * Load module dependencies
 */
const lazypipe = require('lazypipe');
const tap = require('gulp-tap');

/**
 * List of all available hooks. This module does not do anything useful,
 * but specifies the interface of the hooking mechanism.
 *
 * The default configuration of webgen does not load this hooks class.
 * It is only here for serving as inspiration.
 */
class Hooks {

	// **********
	// ********** Samples (not called in code)
	// **********

	/**
	 * A hook should always return a lazypipe.
	 */
	static minimalHook()
	{
		return lazypipe();
	}

	/**
	 * Example of hook that requires a lazypipe (i.e. all of them except the ones defined in
	 * Utils.promisesHooks)
	 * Arguments are an array of provided arguments (behave as the ...args syntax, except
	 * we don't have the ... (... is used in Utils.runHooks(name, ...args) )
	 * @param args
	 */
	static exampleHookWithLazyPipe(args)
	{
		return lazypipe()
			.pipe(tap, (file) =>
			{
				console.info('[HOOK] example with lazypipe ' + file.relative + ' ...... ', args);
			});

	}

	/**
	 * Example of hook that does not use lazypipe (i.e. the ones defined in Utils.promisesHooks)
	 *
	 * args is handled the same as in exampleHookWithLazyPipe()
	 */
	static exampleHookWihtoutLazyPipe(args)
	{
		console.info('[HOOK] example without lazypipe ', args);
		// return Promise or null if no need for a promise. All hooks with this name are chained anyway
		return Promise.resolve();
	}

	// **********
	// ********** Help
	// **********
	static help()
	{
		console.info('[HOOK] additional help');
	}

	// **********
	// ********** Configuration
	// **********

	/**
	 * After configuration loading (after all modules loading is completed, this is the last
	 * configuration step before freezing the configuration object).
	 *
	 * This is not a lazypipe
	 *
	 * @param args[0] contains the Configuration.settings object. It can be modified.
	 */
	static afterConfigurationLoading(args)
	{
		console.info('[HOOK] after configuration loading');
	}

	// **********
	// ********** Clean
	// **********

	/**
	 * Before cleaning building directory
	 *
	 * This is not a lazypipe
	 */
	static beforeCleanBuildDir()
	{
		console.info('[HOOK] before cleaning build dir');
	}

	/**
	 * Before cleaning building directory
	 *
	 * This is not a lazypipe
	 */
	static afterCleanBuildDir()
	{
		console.info('[HOOK] after cleaning build dir');
	}

	// **********
	// ********** Assets
	// **********

	/**
	 * Hook executed before copying assets
	 */
	static beforeCopyAssets()
	{
		console.info('[HOOK] before copy assets');
		return lazypipe();
	}

	// **********
	// ********** Images
	// **********

	/**
	 * Hook executed before images processing
	 */
	static beforeImagesProcessing()
	{
		console.info('[HOOK] before images processing');
		return lazypipe();
	}

	/**
	 * Hook executed after images processing
	 */
	static afterImagesProcessing()
	{
		console.info('[HOOK] after images processing');
		return lazypipe();
	}

	// **********
	// ********** Contents
	// **********

	/**
	 * Hook executed before demultiplexing paths
	 */
	static beforeDemuxPaths()
	{
		console.info('[HOOK] before demux paths');
		return lazypipe();
	}

	/**
	 * Hook executed after demultiplexing paths
	 */
	static afterDemuxPaths()
	{
		console.info('[HOOK] after demux paths');
		return lazypipe();
	}

	/**
	 * Hook executed before applying templates
	 */
	static beforeApplyTemplate()
	{
		console.info('[HOOK] before template exec');
		return lazypipe();
	}

	/**
	 * Hook executed after applying templates
	 */
	static afterApplyTemplate()
	{
		console.info('[HOOK] after template exec');
		return lazypipe();
	}

	/**
	 * Hook executed before applying templates
	 */
	static beforeHtmlRender()
	{
		console.info('[HOOK] before HTML render');
		return lazypipe();
	}

	/**
	 * Hook executed after applying templates
	 */
	static afterHtmlRender()
	{
		console.info('[HOOK] after HTML render');
		return lazypipe();
	}

	/**
	 * Hook executed before i18n processing
	 */
	static beforeI18nProcessing()
	{
		console.info('[HOOK] before i18n processing');
		return lazypipe();
	}

	/**
	 * Hook executed after i18n processing
	 */
	static afterI18nProcessing()
	{
		console.info('[HOOK] after i18n processing');
		return lazypipe();
	}

	/**
	 * Hook executed before content paths correction
	 */
	static beforeContentPathsCorrection()
	{
		console.info('[HOOK] before content paths correction');
		return lazypipe();
	}

	/**
	 * Hook executed after content paths correction
	 */
	static afterContentPathsCorrection()
	{
		console.info('[HOOK] after content paths correction');
		return lazypipe();
	}

	/**
	 * Hook executed before CSS paths corrections
	 */
	static beforeCssPathsCorrection()
	{
		console.info('[HOOK] before CSS paths corrections');
		return lazypipe();
	}

	/**
	 * Hook executed after CSS paths corrections
	 */
	static afterCssPathsCorrection()
	{
		console.info('[HOOK] after CSS paths corrections');
		return lazypipe();
	}

	/**
	 * Hook executed before typographic corrections
	 */
	static beforeTypoCorrection()
	{
		console.info('[HOOK] before typographic corrections');
		return lazypipe();
	}

	/**
	 * Hook executed after typographic corrections
	 */
	static afterTypoCorrection()
	{
		console.info('[HOOK] after typographic corrections');
		return lazypipe();
	}

	// **********
	// ********** XML Sitemap
	// **********

	/**
	 * Hook executed before generation of XML sitemap
	 */
	static beforeXmlSitemapGeneration()
	{
		console.info('[HOOK] before generation of XML sitemap');
		return lazypipe();
	}

	/**
	 * Hook executed after generation of XML sitemap
	 */
	static afterXmlSitemapGeneration()
	{
		console.info('[HOOK] after generation of XML sitemap');
		return lazypipe();
	}

	// **********
	// ********** Styles
	// **********

	/**
	 * Hook executed before processing of styles
	 */
	static beforeStylesProcessing()
	{
		console.info('[HOOK] before processing of styles');
		return lazypipe();
	}

	/**
	 * Hook executed after processing of styles
	 */
	static afterStylesProcessing()
	{
		console.info('[HOOK] after processing of styles');
		return lazypipe();
	}

	// **********
	// ********** Scripts
	// **********

	/**
	 * Hook executed before processing of JavaScript
	 */
	static beforeJavaScriptProcessing()
	{
		console.info('[HOOK] before processing of JavaScript');
		return lazypipe();
	}

	/**
	 * Hook executed after processing of JavaScript
	 */
	static afterJavaScriptProcessing()
	{
		console.info('[HOOK] after processing of JavaScript');
		return lazypipe();
	}

}

/**
 * Module export
 * @type {Hooks}
 */
module.exports = Hooks;

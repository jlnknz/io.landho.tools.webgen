/**
 * Website generator v2 - XmlSitemapHelper.js
 */

'use strict';

/**
 * Load module dependencies
 */
const lazypipe = require('lazypipe');
const through2 = require('through2').obj;
const Utils = require('./Utils');

/**
 * Module providing helpers to build a sitemap
 */
class XmlSitemapHelper {

	/**
	 * Constructor
	 *
	 * @param config
	 */
	constructor(config)
	{
		this.settings = config.settings;
		this.contentsContext = {};
		this.defaultPriority = false;
		this.defaultChangeFrequency = false;
		this.utils = new Utils(config);

		// check that the configuration is valid for this module
		// and set defaults
		config.onLoad(() =>
		{
			if (!this.settings.content.xmlsitemap) {
				return;
			}

			if (this.settings.content.sitemap) {

				// change frequency
				Utils.assert(typeof this.settings.content.sitemap === 'object', 'Sitemap that has been defined is not an object.');
				if (this.settings.content.xmlsitemap.defaultChangeFrequency) {
					Utils.assert(
						[
							'auto', 'always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'
						].indexOf(this.settings.content.xmlsitemap.defaultChangeFrequency) !== -1,
						'Invalid default XML sitemap change frequency.'
					);

					// set change frequency
					this.defaultChangeFrequency =
						this.settings.content.xmlsitemap.defaultChangeFrequency === 'auto'
							? false
							: this.settings.content.xmlsitemap.defaultChangeFrequency;
				}

				// priority
				if (this.settings.content.xmlsitemap.defaultPriority) {
					Utils.assert(
						this.settings.content.xmlsitemap.defaultPriority === 'auto'
						|| (
							/^[01]\.\d+$/.test(this.settings.content.xmlsitemap.defaultPriority)
							&& this.settings.content.xmlsitemap.defaultPriority <= 1.0
						),
						'Invalid default XML sitemap priority.'
					);

					// set default priority
					this.defaultPriority =
						this.settings.content.xmlsitemap.defaultPriority === 'auto'
							? false
							: this.settings.content.xmlsitemap.defaultPriority;
				}
			}
		});


	}


	/**
	 * Get a lazypipe that will do the actuel processing of the XML sitemap.
	 */
	getXmlSitemapProcessor(contentsContext)
	{
		let _self = this;
		this.contentsContext = contentsContext;
		return lazypipe()
			.pipe(this.utils.runHooks('beforeXmlSitemapGeneration'))
			.pipe(through2, function (file, enc, cb)
			{
				file.contents = new Buffer(_self._generateXmlSitemapContent());
				this.push(file);
				cb();
			})
			.pipe(this.utils.runHooks('afterXmlSitemapGeneration'));
	}

	/**
	 * Create the content of the XML Sitemap file
	 * @private
	 */
	_generateXmlSitemapContent()
	{
		let data = {};

		for (let path in this.contentsContext) {
			if (this.contentsContext.hasOwnProperty(path)) {
				// a reference-only node will have target === false
				if (this.contentsContext[path].target) {
					let loc = this.contentsContext[path].canonicalUrl;
					// set frequency and priority for content
					data[loc] = {
						frequency: this.contentsContext[path].xmlsitemap.frequency
							? (
								this.contentsContext[path].xmlsitemap.frequency !== 'auto'
									? this.contentsContext[path].xmlsitemap.frequency
									: false
							)
							: this.defaultChangeFrequency,
						priority: this.contentsContext[path].xmlsitemap.priority
							? (
								this.contentsContext[path].xmlsitemap.priority !== 'auto'
									? this.contentsContext[path].xmlsitemap.priority
									: false
							)
							: this.defaultPriority
						// FIXME find lastmodification - how to determine this? from git repo?
					};
					let alternates = {};
					let ref = this.contentsContext[path].reference;
					for (let lang in this.contentsContext[ref].translationSet) {
						if (this.contentsContext[ref].translationSet.hasOwnProperty(lang)) {
							let other = this.contentsContext[ref].translationSet[lang];
							alternates[lang] = this.contentsContext[other].canonicalUrl;
						}
					}
					data[loc].alternates = alternates;
				}
			}
		}
		return this._xmlsitemapTemplate(data);
	}


	/**
	 * Template for the XML sitemap
	 */
	_xmlsitemapTemplate(data)
	{
		let ret = '<?xml version="1.0" encoding="UTF-8"?>\n'
			+ '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
			+ ' xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
		Object.keys(data).map((url) =>
		{
			ret += `<url>\n<loc>${url}</loc>\n`;
			Object.keys(data[url].alternates).map((lang) =>
			{
				ret += `<xhtml:link rel="alternate" hreflang="${lang}" href="${data[url].alternates[lang]}" />\n`;
			});
			if (data[url].priority) {
				ret += `<priority>${data[url].priority}</priority>\n`;
			}
			if (data[url].frequency) {
				ret += `<changefreq>${data[url].frequency}</changefreq>\n`;
			}
			ret += '</url>\n';
		});
		ret += '</urlset>';
		return ret;
	}


}

/**
 * Module export
 */
module.exports = XmlSitemapHelper;

/*
 * Website generator v2 - Gulpfile.js
 *
 * All tasks made available to the developer
 *
 * Gulp is not configuration-oriented, but well, I am, so everything is based on a configuration file
 * called webgen.yaml (except if this file is specified with a command line parameter). This file is being
 * discovered by the script (see include/Configuration.js).
 *
 * The behavior of this script is documented in `gulp help`
 *
 *
 * FIXME watch does not detect new & deleted files if they are absolute / start with ./
 * See https://stackoverflow.com/questions/22391527/gulps-gulp-watch-not-triggered-for-new-or-deleted-files
 * And then try to rename,add,delete files, e.g. for assets, images,
 */

'use strict';

/**
 * Load modules
 */
const gulp = require('gulp');
const runSequence = require('run-sequence');
const Configuration = require('./include/Configuration');
const Utils = require('./include/Utils');
const Help = require('./include/Help');
const Cleaner = require('./include/Cleaner');
const AssetsHandler = require('./include/AssetsHandler');
const ImagesHandler = require('./include/ImagesHandler');
const StylesHandler = require('./include/StylesHandler');
const ScriptsHandler = require('./include/ScriptsHandler');
const ContentsHandler = require('./include/ContentsHandler');

/**
 * Module defining a new Gulp process
 */
class WebGenGulp {

	/**
	 * Constructor
	 */
	constructor()
	{
		this.config = new Configuration();
		this.cleaner = new Cleaner(this.config);
		this.assets = new AssetsHandler(this.config);
		this.images = new ImagesHandler(this.config);
		this.styles = new StylesHandler(this.config);
		this.scripts = new ScriptsHandler(this.config);
		this.contents = new ContentsHandler(this.config);
		this.utils = new Utils(this.config);

		this.configCallbacksReady = false;
	}

	/**
	 * Initialize the Gulp process (configuration and tasks)
	 */
	init()
	{
		// load the configuration object only if we are not accessing the 'help' task (or 'default' task, which is an alias)
		const tasks = require('minimist')(process.argv.slice(2))._;
		for (let t of tasks) {
			// if we are not requesting the help task (or default which is equivalent), then initialize the configuration
			// object for it to be later used. Also move to the appropriate working directory.
			if (['help', 'default'].indexOf(t) === -1) {
				try {
					// load configuration
					// the onLoad() callbacks might not be ready at this point (promises), but the basic configuration
					// is ready when load() returns
					this.configCallbacksReady = this.config.load();

					// some user-friendly summary of current configuration being run
					console.info('>>> ');
					console.info(`>>> ${this.config.settings.appName} - ${this.config.settings.appVersion}`);
					if (this.config.settings.author) {
						console.info(`>>> Author: ${this.config.settings.author}`);
					}
					console.info('>>> ');
					console.info(`>>> Configuration file being used: |${this.config.source}|.`);
					console.info('>>>');
				}
				catch (e) {
					Utils.die(`The configuration could not be loaded because of the below error: ${e}\nTry to call \'gulp help\'`);
				}
				break;
			}
		}

		this._setupTasks();
	}

	/**
	 * Setup tasks.
	 *
	 * @private
	 */
	_setupTasks()
	{
		// Documentation
		gulp.task('help', () => Help.synopsis());
		gulp.task('default', ['help']);


		// Cleaning
		gulp.task('clean:build-dir', (c) =>
		{
			return this.configCallbacksReady.then(() => this.cleaner.cleanBuildDir());
		});
		gulp.task('clean', ['clean:build-dir']);


		// extract i18n strings
		gulp.task('i18n-extract', () => this.configCallbacksReady.then(() => this.contents.extractI18nStrings()));

		// Assets
		gulp.task('assets', () => this.configCallbacksReady.then(() => this.assets.copy()));

		// Images
		gulp.task('images', () => this.configCallbacksReady.then(() => this.images.process()));

		// Styles
		gulp.task('styles', () => this.configCallbacksReady.then(() => this.styles.processAllSets()));

		// Scripts
		gulp.task('scripts', () => this.configCallbacksReady.then(() => this.scripts.processAllSets()));

		// Contents
		gulp.task('content', () => this.configCallbacksReady.then(() => this.contents.processContents()));

		// XML Sitemap
		gulp.task('xmlsitemap', () => this.configCallbacksReady.then(() => this.contents.generateXmlSitemap()));

		// QA styles
		gulp.task('qa:styles', (c) => this.configCallbacksReady.then(() => this.styles.lint()));

		// QA scripts
		gulp.task('qa:lint-js', (c) =>
		{
			this.configCallbacksReady.then(() =>
				this.scripts.lintJavaScript().on('finish', () => c())
			);
		});
		/*
		 FIXME  disabled for now, typescript hanlding is broken
		 gulp.task('qa:lint-ts', (c) =>

		 {
		 this.configCallbacksReady.then(() =>
		 this.scripts.lintTypeScript().on('finish', () => c())
		 );
		 });
		 */
		gulp.task('qa:lint-scripts', [/* FIXME disabled 'qa:lint-ts', */'qa:lint-js']);
		gulp.task('qa:unit-tests-scripts', (c) =>
		{
			this.configCallbacksReady.then(() =>
				this.scripts.runUnitTests().on('finish', () => c())
			);
		});
		gulp.task('qa:scripts', ['qa:lint-scripts', 'qa:unit-tests-scripts']);

		// QA contents
		gulp.task('qa:content', (c) =>
		{
			this.configCallbacksReady.then(() =>
				this.contents.lintContents().on('finish', () => c())
			);
		});

		gulp.task('qa', ['qa:styles', 'qa:scripts', 'qa:content']);

		// Build task, re-using build sub tasks, after having checked the QA of the project.
		// In release mode, the script will fail if the QA task fails.
		gulp.task(
			'build',
			['assets', 'images', 'styles', 'scripts', 'content', 'xmlsitemap']
		);

		// change release flag to true
		gulp.task('config:release', (c) =>
		{
			this.configCallbacksReady.then(() =>
				{
					this.config.enableReleaseMode();
					c();
				}
			)
		});

		// build a release
		gulp.task('release', () => this.configCallbacksReady.then(() =>
			{
				runSequence(
					['config:release'],
		// FIXME fails sequence even if no error			['qa'],
			 		['build']
				)
			})
		);

		// Watching of unit tests
		gulp.task(
			'watch:run-unit-tests',
			// 	['qa:unit-tests-scripts'], // if enabled, kills the process??? FIXME
			() => this.configCallbacksReady.then(() =>
			{
				this.scripts.runUnitTests(); // execute first run because of failure in run dependency (FIXME 2 lines above)

				// FIXME cannot simply call ['qa:unit-tests-js'] because of mocha called in same process? to check why.
				gulp.watch(this.config.settings.scripts.unitTests, (c) =>
				{
					this.scripts.runUnitTests().on('finish', () => c());
				});
			})
		);

		// Watching of build tasks
		// FIXME quite buggy, but let's wait for gulp 4 before refactoring.
		gulp.task(
			'watch:build',
			['build'],
			() => this.configCallbacksReady.then(() =>
			{
				// FIXME not triggered if newfile, but ok if delete OR modif
				// if create directory -> ok, if delete dir, not ok
				// if delete directory full of files, not ok
				gulp.watch(this.config.settings.buildPath + '/**').on('change', () => this.utils.reloadBrowserOnChange());
				// exit if we modify the configuration file
				gulp.watch(this.config.source,
					(event) =>
					{
						console.log('whaaa');
						// apparently if directories are created in the build directory, this watch is triggered.
						// FIXME I don't understand why
						if (event.type === 'changed') {
							Utils.die("The configuration file has been modified. Exiting watch task.");

						}
					}
				);

				// assets and images
				// does not delete existing files, which is acceptable
				// FIXME does not work: add new file
				// 		works: rename, delete (but does not remove), add dir
				gulp.watch(this.config.settings.assets.input, ['assets']);
				gulp.watch(this.config.settings.images.input, ['images']);

				// styles
				// by creating one watch per set, we avoid having to re-compile all styles every time we change
				// one of the files. Here, we will only compile the modified set.
				this.styles.doOnAllSets((set) => {
					gulp.watch(set.watch, () => this.styles.process(set));
				});

				// scripts
				// same logic as for styles
				this.scripts.doOnAllSets((set) =>
				{
					console.log(set.watch);
					gulp.watch(set.watch, () => this.scripts.process(set));
				});

				// contents
				gulp.watch(this.config.settings.content.input, ['content', 'xmlsitemap']);

				// watch additional files and rebuild everything if they are touched
				gulp.watch(this.config.settings.additionallyWatchedFiles, (event) =>
					{
						console.log('restart');
						// apparently if directories are created in the build directory, this watch is triggered.
						// FIXME I don't understand why
						// same problem as above when watching config file
						if (event.type === 'changed') {
							return runSequence(
								['clean:build-dir'], // FIXME clean makes things fail. Try with simpler task.
								// or try to wait for a few seconds before resolve. but i think it's rather caused by promise returning troo early
								['build']
							);
						}
					}
				);
			})
		);

		// Open a browser-sync-enabled server
		gulp.task(
			'serve',
			['watch:build'],
			() => this.configCallbacksReady.then(() =>
			{
				this.config.settings.browserSync.instance.init(this.config.settings.browserSync.config);
			})
		);

	}
}


/**
 * Entry point
 */
new WebGenGulp().init();

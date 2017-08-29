/**
 * Website generator v2 - Help.js
 */

'use strict';

/**
 * Get package.json of the website generator to know its current release information.
 */
const pkg = require(__dirname + '/../package.json');

/**
 * Module providing command line help
 */
class Help {

	/**
	 * Print the synopsis of the application
	 */
	static synopsis()
	{
		console.info(
			[
				'Website generator ' + pkg.version,
				'',
				'Tasks:',
				' > help           : This message',
				' > clean          : Delete development build directory',
				' > i18n-extract   : Extract translatable strings from the code and update the i18n CSV file',
				' > build          : Build everything in dev mode',
				' > qa             : Run all QA operations',
				' > watch:build    : Build everything and watch for changes',
				' > watch:run-unit-tests',
				'                  : Build everything and watch for changes',
				' > serve          : Build everything, watch for changes, and launch a browser with synchronization',
				' > release        : Build a release',
				'',
				'Full list:',
				' $ gulp --tasks',
				'',
				'Notes:',
				' - The application will look for a webgen.yaml configuration file in upper directories',
				' - It is also possible to specify the configuration file with the --config <filename> argument ',
				'   or pass it via the WEBGEN_CONFIG environment variable.',
				''
			].join("\n")
		);
	}
}

/**
 * Export the module
 */
module.exports = Help;

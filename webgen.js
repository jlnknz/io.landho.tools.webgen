#!/usr/bin/env node
/*
 * Website generator v2 - webgen.js
 *
 * Standalone executable for running the different gulp tasks.
 *
 */

'use strict';

/**
 * Load dependencies
 */
const gulpRunner = require('gulp-runner');
let gulp = new gulpRunner(__dirname + '/Gulpfile.js');

/**
 * Get command line instructions
 */
const args = require('minimist')(process.argv.slice(2));
const tasks = args._;
const config = args.config;

let opts = {
	cwd: process.cwd(),
	config: config
};

/**
 * Run the requested task
 */
gulp.run(tasks, opts);

/**
 * Handle events, otherwise nothing will be displayed
 */
gulp.on('log', function (data)
{
	process.stdout.write(data);
});

gulp.on('error', function(err) {
	process.stderr.write(err);
});

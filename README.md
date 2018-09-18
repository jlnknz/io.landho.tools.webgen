# Website Generator v2

Copyright (c) 2017 Julien Künzi <jlnknz@landho.io>

Licensed under the GNU GENERAL PUBLIC LICENSE, version 3. 
See LICENSE for more information.

````
****
**** WORK IN PROGRESS
****
**** This is still ongoing work. Some features may not be 
**** completed, yet. Likewise, the documentation may not 
**** be up to date. Yep, for now it's a bit a mess.
****
**** This document also contains somes personal thought
**** on the orientation to give to this tool.
****
**** Long story short: this tool probably does not meet quality
**** requirements you would expect for building your website.
**** You should rather use another existing solutions.
**** 
````

## Description

Yet another web development starter kit.

It features the following tasks:

1. Assets copying
1. Images 
1. (S)CSS styling
1. JavaScript and TypeScript
1. HTML/Markdown/Handlebars contents with the ability to define Handlebars masters containing contents.
1. Linting of all code (styles, js, ts, html)
1. i18n
1. Unit tests (js, ts)
1. Watching of modifications (with live reload through BrowserSync)
1. Releasing

Look at the `docs/example-website` directory for a complete example of available features.

## Configuration

Gulp is not configuration-oriented, but I am. So all tasks configuration are defined in `config.default.yaml`
and can be overriden in the you project's configuration file (default name: `webgen.yaml`). This configuration
file can be empty but must exist. It marks the root of your project.

All sources are in the `src/` directory.

See `config.default.yaml` for more information about available options. 

## Run

````
$ gulp help
Website generator v2.0.0

Tasks:
 > help           : This message
 > clean          : Delete development build directory
 > i18n-extract   : Buil
 > build          : Build everything in dev mode
 > qa             : Run all QA operations
 > watch:build    : Build everything and watch for changes
 > watch:run-unit-tests: Build everything and watch for changes
 > serve          : Build everything, watch for changes, and launch a browser with synchronization
 > release        : Build a release

Full list:
 $ gulp --tasks

Notes:
 - The application will look for a webgen.yaml configuration file in upper directories
 - It is also possible to specify the configuration file with the --config <filename> argument 
   or pass it via the WEBGEN_CONFIG environment variable.
````


## How to ...

### Keep comments in release mode?

- (s)css: /*! ... */
- js/ts: comment on first line is kept and if contains some strings such as (c) and License. See licenseRegexp at https://github.com/shinnn/uglify-save-license/blob/master/index.js
- html/handlebars: <!--! ... -->


### Run a custom version of nodejs?

https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-ubuntu-16-04

Update used version sometimes. 

Works with node v9.2.0.

### Update all packages to their latest versions? 

````
npm install -g npm-check-updates
ncu 
ncu -u
````

## Next developments

- FIXME replace gulp-util which is deprecated

- should I use karma? Review test - also with angular, using its testbed.
	https://github.com/karma-runner/gulp-karma
	mocha or jasmine dependency should be in built project, not in webgen
	
- would not hurt to modularize a bit more... 

- handle errors such that they do not make watch/serve fail - be resilient
	- release process fails. probablement related to above
	- plumber?
	- or https://github.com/terinjokes/gulp-uglify/blob/master/docs/why-use-pump/README.md#why-use-pump pump!
	
- babel : createClass functions created 1x per class in concat-enated file. check if we can do something.
		solution: https://github.com/babel/babelify/issues/170

- how to complement default configuration?
	e.g. assets:
				input:
						- '__default__'
						- 'blah.txt'
						
- sourcemaps are broken ? (js) 

- make script defer/async more flexible by adding an option into scripts.sets[x].options
		-> should set absolute path!

- to check: browserify: have to change to directory of currently analysed file, otherwise
  references to other files are broken. is that okk to chdir()?
  			- sometimes chdir() in browserify makes everything fail 
  		
- work on typescript - for now all is disabled.

- Add 'repository' entry in package.json
	
- Some additional efforts on documentation and bug fixing 

- add hint attribute to i18n tags to help translators

- handle errors in pipes - understand how it works.
	maybe also handle other events, such as ('end')
	gulp-plumber to avoid crashing pipe 
	also see comments regarding typescript (in code)
	
- create one content file per feature to list exhaustively. Or create documentation web page.

- implement english/french/german typographic rules (do something normative)

- try to remove as many dependencies as possible 

- RULE: we do NOT babelify our code for internal use. User is expected to use environment that supports latest features, 
such as es6. However, we DO babelify the output such that app can be used by anyone.

- angular2
- unit tests
	- PHP => ?
	
- live-tests
	- e2e (selenium)
	- google page insights
	- as a separate project as depends on the target deployment platform (?)

- think of possibility to move to gettext for i18n extracting - would be easier to translate in js apps.

may need to include:
- chai
in devDependencies of new project? or do we include it into webgen? do we use it?
	
## Bugs / limitations (won't fix for now)

- Typescripts not working for now (problems with es6 module imports / typings. read more documentation and review.)
	- generate *.d.ts (declaration=true) in typescript?

- We should make sure that users rename their images when releasing a new version. This would imply using gitnode or
equivalent to check the file names in previous releases. 

- Best practice: CSS/JS should never expire from browser cache -> .htaccess rule?

- typographic: rather than altering only what is between > and <, do remove all tags (like with <no-typo>), alter all
content, and then move the tags back in place. Can be quite slow, but the result would be better (?)


## Science fiction

- gulp serve -> accessible by customer -> gulp publish -> push online
	- git master repository = staging environment
	- releases = git tags
 	- store passwords in another file, do not commit this file to git. e.g. credentials.yaml -> git.password, git.user
	- biggest issue: make contents easily editable
	- this is another project, perhaps using this one.
	
	
# issues
- modify misc/LICENSE.hbs -> crash
		even if does not crash, will not be reloaded (?). To check.
		
- what should linter do? fail and crash, or fail and succeed. For now:
scss: fail if error

- Included files (with include-file helper) are not watched. We should add 
  a parameter to define a list of alternate files to watch
  workaround: put the includes into content/include/whatever.hbs
  the default input for content does not take subdirectories into account
  (that would actually break the paths if we did that)



------
watch/ edit master-example.hbs - trigger rebuild by watch 
---> 
events.js:136
      throw er; // Unhandled 'error' event
      ^

Error: watch /home/jlnknz/Workspace/io.landho.tools.webgen/docs/example-website/build-dev/features ENOENT
    at _errnoException (util.js:1031:13)
    at FSWatcher.start (fs.js:1397:19)
    at Object.fs.watch (fs.js:1423:11)
    at Gaze._watchDir (/home/jlnknz/Workspace/io.landho.tools.webgen/node_modules/gaze/lib/gaze.js:289:30)
    at /home/jlnknz/Workspace/io.landho.tools.webgen/node_modules/gaze/lib/gaze.js:358:10
    at iterate (/home/jlnknz/Workspace/io.landho.tools.webgen/node_modules/gaze/lib/helper.js:52:5)
    at /home/jlnknz/Workspace/io.landho.tools.webgen/node_modules/gaze/lib/helper.js:61:11
    at /home/jlnknz/Workspace/io.landho.tools.webgen/node_modules/gaze/lib/gaze.js:420:5
    at iterate (/home/jlnknz/Workspace/io.landho.tools.webgen/node_modules/gaze/lib/helper.js:52:5)
    at /home/jlnknz/Workspace/io.landho.tools.webgen/node_modules/gaze/lib/helper.js:61:11
    at /home/jlnknz/Workspace/io.landho.tools.webgen/node_modules/gaze/lib/gaze.js:420:5
    at iterate (/home/jlnknz/Workspace/io.landho.tools.webgen/node_modules/gaze/lib/helper.js:52:5)
    at /home/jlnknz/Workspace/io.landho.tools.webgen/node_modules/gaze/lib/helper.js:61:11
    at /home/jlnknz/Workspace/io.landho.tools.webgen/node_modules/gaze/lib/gaze.js:420:5
    at iterate (/home/jlnknz/Workspace/io.landho.tools.webgen/node_modules/gaze/lib/helper.js:52:5)
    at /home/jlnknz/Workspace/io.landho.tools.webgen/node_modules/gaze/lib/helper.js:61:11


-------------------------------------------
hooks implementation to check. to sure it works

-------------
scripts does not work. related to ts?
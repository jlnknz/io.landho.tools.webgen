// unit tests can be anywhere, following the file name pattern defined in the configuration file
//
// es6-style imports are NOT supported by node as of 6.9.4, and so cannot be used
// in tests as tests are not production code
// NOT valid: import {assert} from 'assert';

// use chai assert style
const assert = require('chai').assert;

// TDD-style interface
suite('Dummy component', function() {
	setup(function() {
		// ...... ...
	});

	suite('#dummyFunction()', function() {
		test('should return true', function() {
			assert.equal(true, 1 !== 0);
		});
		test('should return false', function() {
			assert.equal(false, 1 === 0);
		});
		test('should handle something');
	});
});

/* if we prefer the default 'bdd' interface:
 describe('Home page', function () {
 it('should load the page properly');
 it('should navigate to login');
 it('should navigate to sign up');
 it('should load analytics');
 });
 */
// DOCUMENTATION
// - qa:js			Warnings
// - scripts:app	No warnings, concatenated in aggregated JS

'use strict'

function javaScriptFunctionWithWarnings() {
	var a = 42;
	b = 42 + a;
	if (a = 1) {
		console.log('out warnings js')
	}
}

javaScriptFunctionWithWarnings();
// DOCUMENTATION
// - qa:js			No problem
// - scripts:app	No problem, concatenated in aggregated JS

import * as testimport from 'gulp'; // and babel-ize

var JavaScriptToBabel = {

	msg: "World!!",

	hello: function ()
	{
		[1,2,3].map(n => n + 1);
		testimport.src();
		return 'Hello' + this.msg;
	}

};

JavaScriptToBabel.hello();
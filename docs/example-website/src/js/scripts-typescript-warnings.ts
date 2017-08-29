// DOCUMENTATION
// - qa:js			Warnings
// - scripts:app	Warnings, concatenated in aggregated JS


class TypeScriptWithWarnings {
	constructor(public greeting: string) { }
	greet() {
		return "<h1>" + this.greeting + "</h1>";
	}
};

var greeter = new TypeScriptWithWarnings("Hello, typescript with warnings!");

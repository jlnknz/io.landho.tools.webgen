<!--
**** start-content-config ****
title:				Markdown in master
master:				master-example
path:
    fr:            /within-master-examples/markdown-fr.html
    de:            /within-master-examples/markdown-de.html
    en:            /within-master-examples/markdown-en.html
**** end-content-config ****
-->
# A simple markdown document

With a paragraph and __bold text__ and 

	some code
	etc.
	
We can also use i18n features using both syntaxes: {i18n Hello}, <i18n>Hello</i18n>.

And by defining paths in the YAML header, we define the output files. 
If we don't, the source filename is used, and the extension is 
replaced by .html. 

We cannot use title or shortTitle in markdown contents.

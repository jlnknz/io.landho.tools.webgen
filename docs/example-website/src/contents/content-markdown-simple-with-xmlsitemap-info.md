<!--
**** start-content-config ****
path:
    fr:             /markdown-examples/simple-fr-with-xmlsitemap-info.html
    de:             /markdown-examples/simple-de-with-xmlsitemap-info.html
    en:				/markdown-examples/simple-en-with-xmlsitemap-info.html
xmlsitemap:
	priority:		0.85
	frequency:		daily
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

## XML Sitemap
Additionally, if we define 

<pre>
sitemap-xml:
	priority:		[1.0 .. 0.0]
	frequency:		(always|hourly|daily|weekly|monthly|yearly|never)
</pre>

in the YAML preamble, the default settings defined in this.settings.content.xmlsitemap configuration node entry 
will be overriden for this content.

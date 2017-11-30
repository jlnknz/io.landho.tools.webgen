<!--
**** start-content-config ****
title:			<i18n>I18n features</i18n>
path:
	fr:			/features/i18n-fr.html
	de:			/features/i18n-de.html
	en:			/features/i18n-en.html
**** end-content-config ****
-->

# I18n features

## Extracts strings
 
FIXME 

## Translation from config.i18n.source file

Usually the language is defined by the YAML section (path with more than one language), but if we don't 
specify a language in the YAML section,
the language is autodetected (the `lang` attribute of the `html` tag is inspected). 
Note that if no language can be autodetected, the fallback language
`config.i18n.fallbackLanguage` will be used.

 - Fully working translation, brace syntax: {i18n Hello}
 - Translation falling back to fallback language, XML syntax: <i18n>Hi</i18n>
 - No translation available, brace syntax: {i18n Bye}

We can also translate a string that is split on multiple lines (extra spaces are normalized to a single space):

<i18n>
	line 1
	line 2
</i18n>

{i18n
	line 1
	line 2
	}


## Keep excerpts only in some language or exclude in some language

Only in current language: |<fr>francais</fr><de>allemand</de><en>anglais</en>|

Not in current language: |<not-fr>francais</not-fr>,<not-de>allemand</not-de>,<not-en>anglais</not-en>|


## Language switcher

Only in Handlebar contents (see FIXME): 

	{{> language-switcher }}
	{{> language-switcher classes="language-switcher native" style='native' }}
	{{> language-switcher classes="language-switcher short" style='short' }}
	{{> language-switcher classes="language-switcher current" style='current' }}

<!--
**** start-content-config ****
title:			Typographic features
path:
	fr:			/features/typo-fr.html
	de:			/features/typo-de.html
	en:			/features/typo-en.html
**** end-content-config ****
-->

# Typograhic features

## General functioning

The application will alter the content when it makes sense from a typographic point of view. 
The rules depend on the current language (FIXME - for now only a few English rules are applied).

For now, we only add non-breaking spaces.

Example: This text will be corrected: a a a a a 42 km a a a a

## Excluding typographic corrections

<no-typo>This block will not be corrected: a a a a a 42 km a a a a</no-typo>

and 

<no-typo>So does this block: a a a a a 42 km a a a a</no-typo>

## Forcing non breaking spaces

<no-break>
This block will never break
</no-break>

and 

<no-break>so does this one</no-break>

## What is not processed?

All contents that are not within HTML content are not processed. So if you create an HTML file that does not contain 
any tag, its content won't be corrected. More specifically, we process what is between > and <.
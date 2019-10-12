#!/usr/bin/env bash
#
# UNIX-only, not so good.
# the webgen.yaml file must be in the current directory

TASK=$1
CURDIR=$(pwd)
gulp --gulpfile ${CURDIR}/node_modules/io.landho.tools.webgen/Gulpfile.js --cwd ${CURDIR} ${TASK}

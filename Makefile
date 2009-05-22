ROOT=~/Projekte/Comp/2008/FileIt/shelve

default: version jsl compile

compile:
	${ROOT}/build.sh

jsl:
	for f in ${ROOT}/content/*.js; do \
		jsl -conf jsl.conf -nofilelisting -nocontext -nosummary -nologo -process `cygpath -w $$f`; \
		done

lint: jsl

version:
	grep -r -P '(em:version>|\&version; )\d+\.\d+' ${ROOT}/*

next: version
	ed.bat `cygpath -w ${ROOT}/content/about.xul`
	ed.bat `cygpath -w ${ROOT}/install.rdf`

repo:
	git.cmd push origin master


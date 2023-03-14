install:
	@npm install

help:
	@node -e "console.log(Object.keys(require('.' + require('path').sep + 'package.json').scripts || {}))"

%:
	@npm run $@
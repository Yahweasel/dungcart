all: mapper.js printable.js

%.js: %.ts mapp.ts node_modules/.bin/tsc
	node_modules/.bin/tsc $<
	chmod a+x $@

node_modules/.bin/tsc:
	npm install

clean:
	rm -f mapper.js printable.js mapp.js

distclean: clean
	rm -rf node_modules package-lock.json

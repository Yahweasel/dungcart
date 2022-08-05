all: mapper.js

mapper.js: mapper.ts node_modules/.bin/tsc
	node_modules/.bin/tsc $<
	chmod a+x $@

node_modules/.bin/tsc:
	npm install

clean:
	rm -f mapper.js

distclean: clean
	rm -rf node_modules package-lock.json

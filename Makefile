JS=\
	io.js \
	mapper.js \
	printable.js \
	state.js

all: $(JS)
	chmod a+x mapper.js
	chmod a+x printable.js

%.js: %.ts node_modules/.bin/tsc
	node_modules/.bin/tsc $<

node_modules/.bin/tsc:
	npm install

clean:
	rm -f $(JS)

distclean: clean
	rm -rf node_modules package-lock.json

mapper.ts: io.ts mapp.ts state.ts

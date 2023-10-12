.PHONY: all clean relock run serve watch

all: \
	www/index.js \
	www/index.css \
	www/index.html \
	www/nonnosus.ttl \
	www/rules.n3 \
	www/queries/extents.n3

run: www/index.js
	node $<

serve: build.cjs all
	node $< serve

relock:
	rm -f package-lock.json
	npm i --package-lock-only

clean:
	rm -rf node_modules www

node_modules/.bin/esbuild:
	npm install

www/index.js: \
	build.cjs \
	tsconfig.json \
	src/index.ts \
	node_modules/.bin/esbuild
	# end prerequisites
	node $<

www/index.%: src/index.%
	cp $< $@

www/queries/%: src/queries/%
	mkdir -p www/queries
	cp $< $@

www/%: ../nonnosus/%
	ln $< $@

#!/bin/bash

scriptdir=`dirname "$BASH_SOURCE"`

git clone git@github.com:getredash/redash.git "$scriptdir/redash"
cd "$scriptdir/redash"
git checkout v10.1.0
cp "$scriptdir/.env.example" ./.env
cat package.json | fx "{ ...this, engines: {} }" > package-new.json && mv package.json package-original.json && mv package-new.json package.json
yarn
yarn build

docker-compose run --rm server create_db
docker-compose up -d

cd "$scriptdir"

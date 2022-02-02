#!/bin/bash

scriptdir=`dirname "$BASH_SOURCE"`

for i in {1..10000}
do
  cat "$scriptdir/../data/face/$i.json" | fx "{...this, id: $i}" > /tmp/ga-faces-tmp.json
  mongoimport --uri mongodb://localhost:27017/gangenalumni --collection faces --type json --file /tmp/ga-faces-tmp.json;
  cat "$scriptdir/../data/label/$i.json" | fx "{...this, id: $i}" > /tmp/ga-labels-tmp.json
  mongoimport --uri mongodb://localhost:27017/gangenalumni --collection labels --type json --file /tmp/ga-labels-tmp.json;
done

rm -rf /tmp/ga-faces-tmp.json
rm -rf /tmp/ga-labels-tmp.json

echo "Faces files imported!"


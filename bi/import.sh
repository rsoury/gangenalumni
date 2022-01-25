#!/bin/bash

for i in {1..10000}
do
  cat "../data/face/$i.json" | fx "{...this, id: $i}" > /tmp/ga-tmp.json
  mongoimport --uri mongodb://localhost:27017/gangenalumni --collection faces --type json --file /tmp/ga-tmp.json;
done

rm -rf /tmp/ga-tmp.json

echo "Faces files imported!"


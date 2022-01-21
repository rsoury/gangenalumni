#!/bin/bash

for i in {1..10000}
do
  mongoimport --uri mongodb://localhost:27017/gangenalumni --collection faces --type json --file "../data/face/$i.jpeg";
done

echo "Faces files imported!"


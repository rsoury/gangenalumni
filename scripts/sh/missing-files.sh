#!/bin/bash

for i in {1..10000}
do
  if [ ! -f "$i.jpeg" ]; then
    echo "$i.jpeg does not exist"
  fi
done

echo "Files checked!"


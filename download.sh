#!/bin/bash

# Download all of the files listed in sites.txt to `data` directory
# The sites.txt file must have a new line at the end


mkdir data >/dev/null 2>&1
cd data

while read line; do
  set -- $line
  url=$1
  if [ -n "$url" ] ; then
    if [ "${url:0:1}" != "#" ] ; then
      curl -LO $url
    fi
  fi
done < ../sites.txt

cd ..
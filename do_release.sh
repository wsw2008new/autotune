#!/bin/bash

if ! git diff-index --quiet HEAD --; then
  echo You must commit all your changes before updating the version
  exit 1
fi

if [ $# -ne 1 ]; then
  old_version=$(jq '.version' package.json)
  echo Current version is $old_version. Please enter a new version:
  read $version
else
  version=$1
fi

command -v jq >/dev/null 2>&1 || { echo >&2 "Missing jq. Please install jq."; exit 1; }
command -v sponge >/dev/null 2>&1 || { echo >&2 "Missing sponge. Please install moreutils."; exit 1; }

jq ".version |= $version" package.json |sponge package.json
git commit -am "bump to $version"
git tag v$version
#git push --tags


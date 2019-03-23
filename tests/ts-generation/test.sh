#!/bin/bash

set -e

cd $(dirname $0)

echo "Testing Typescript declaration generation"
npx delisp compile --ts-declaration example.dl
npx tsc --noEmit example.ts



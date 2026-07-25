#!/usr/bin/env bash
set -e

# start container if it exists, otherwise create and run
docker start mock-auth 2>/dev/null || \
  MSYS_NO_PATHCONV=1 docker run --name mock-auth -d \
  -p 9000:9000 \
  mock-auth

#!/bin/bash
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
. $SCRIPT_DIR/common.sh

pushd $PROJECT_DIR
bun run dev
popd
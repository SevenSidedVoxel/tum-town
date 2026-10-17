# Exit on errors: https://intoli.com/blog/exit-on-errors-in-bash-scripts/
set -e
# Keep track of the last executed command
trap 'last_command=$current_command; current_command=$BASH_COMMAND' DEBUG
# Echo an error message before exiting
trap 'echo "Command [${last_command}] failed with exit code [$?]!"' ERR

export TIMESTAMP=`date "+%Y.%m.%d_%H.%M.%S"`
export PROJECT_DIR=$(realpath "$SCRIPT_DIR/..")
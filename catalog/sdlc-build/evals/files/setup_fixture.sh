#!/usr/bin/env bash
# Build a throwaway git repo for one sdlc-build eval case.
#
# Usage: setup_fixture.sh <case> <dest-dir>
#   case: csv-export | reminders | account-deletion
#
# Every case starts from base-app/ committed on `main`. Then:
#   csv-export        intent + spec both merged to main; HEAD on the feature branch.
#   reminders         intent merged to main; spec committed only on an unmerged
#                     `spec/TASK-131-due-date-reminders` branch, which is checked out.
#   account-deletion  intent + spec both merged to main; HEAD on the feature branch.
set -euo pipefail

case_name="$1"
dest="$2"
here="$(cd "$(dirname "$0")" && pwd)"

case "$case_name" in
  csv-export) folder="TASK-118-csv-export" ;;
  reminders) folder="TASK-131-due-date-reminders" ;;
  account-deletion) folder="TASK-140-account-deletion" ;;
  *) echo "unknown case: $case_name" >&2; exit 2 ;;
esac

if [ -e "$dest" ] && [ -n "$(ls -A "$dest" 2>/dev/null)" ]; then
  echo "refusing to overwrite non-empty $dest" >&2
  exit 2
fi
mkdir -p "$dest"
cp -R "$here/base-app/." "$dest/"
cd "$dest"

g() { git -c core.autocrlf=false -c user.name="Fixture Bot" -c user.email="fixture@example.com" "$@"; }

g init -q -b main
printf 'node_modules/\naudit.log\n' > .gitignore
g add -A
g commit -q -m "chore: initial tasklist app"

docs="docs/sdlc/$folder"
src="$here/cases/$case_name/$docs"
mkdir -p "$docs"

# Intent is always accepted (merged via a PR-style merge commit).
g checkout -q -b "intent/$folder"
cp "$src/intent.md" "$docs/intent.md"
g add -A
g commit -q -m "intent: $folder"
g checkout -q main
g merge -q --no-ff "intent/$folder" -m "Merge intent/$folder"

g checkout -q -b "spec/$folder"
cp "$src/spec.md" "$docs/spec.md"
g add -A
g commit -q -m "spec: $folder"

if [ "$case_name" = "reminders" ]; then
  # Spec PR still open: leave HEAD on the unmerged spec branch.
  :
else
  g checkout -q main
  g merge -q --no-ff "spec/$folder" -m "Merge spec/$folder"
  g checkout -q -b "feat/$folder"
fi

echo "fixture ready: $dest ($(git branch --show-current))"

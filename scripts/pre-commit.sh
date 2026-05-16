#!/usr/bin/env bash
# Pre-commit hook — run skill validation before every commit.
#
# Symlink this into .git/hooks/ after cloning:
#   ln -sf ../../scripts/pre-commit.sh .git/hooks/pre-commit
#   chmod +x scripts/pre-commit.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Running skill validation..."
"$REPO_ROOT/scripts/validate-skills.sh"

# Run markdownlint if installed (optional — not a required dependency)
if command -v markdownlint &>/dev/null; then
  echo "Running markdownlint..."
  markdownlint \
    --config "$REPO_ROOT/.markdownlint.json" \
    "$REPO_ROOT/skills/"*/SKILL.md \
    "$REPO_ROOT/README.md" \
    "$REPO_ROOT/CONTRIBUTING.md" \
    "$REPO_ROOT/CLAUDE.md"
fi

echo "Pre-commit checks passed."

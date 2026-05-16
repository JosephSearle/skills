#!/usr/bin/env bash
# Validates all skills in the skills/ directory against repository authoring standards.
# Exit 0 = all checks pass. Exit 1 = at least one failure.
# Outputs one ERROR line per failure; prints a success message on clean run.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS_DIR="$REPO_ROOT/skills"
README="$REPO_ROOT/README.md"

errors=0

fail() {
  echo "ERROR: $*" >&2
  errors=$((errors + 1))
}

# ─── 1. Parse README Skills Index ────────────────────────────────────────────
# Matches rows of the form: | [skill-name](skills/...) | ... |
readme_skills=()
while IFS= read -r line; do
  if [[ "$line" =~ ^\|\ \[([a-z0-9-]+)\] ]]; then
    readme_skills+=("${BASH_REMATCH[1]}")
  fi
done < "$README"

# ─── 2. Iterate every skill directory ────────────────────────────────────────
dir_skills=()
for skill_dir in "$SKILLS_DIR"/*/; do
  [[ -d "$skill_dir" ]] || continue
  skill_name="$(basename "$skill_dir")"
  dir_skills+=("$skill_name")

  skill_file="$skill_dir/SKILL.md"

  # 2a. Naming convention: <domain>-<action> kebab-case, at least two segments
  if ! [[ "$skill_name" =~ ^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)+$ ]]; then
    fail "[$skill_name] directory name does not match <domain>-<action> kebab-case pattern"
  fi

  # 2b. SKILL.md must exist
  if [[ ! -f "$skill_file" ]]; then
    fail "[$skill_name] missing SKILL.md"
    continue
  fi

  # 2c. Parse YAML frontmatter (between first and second "---")
  fm_name=""
  fm_description=""
  fm_desc_started=0
  first_delim=0
  in_frontmatter=0

  while IFS= read -r line; do
    if [[ "$line" == "---" ]]; then
      if [[ $first_delim -eq 0 ]]; then
        first_delim=1
        in_frontmatter=1
        continue
      else
        break
      fi
    fi
    if [[ $in_frontmatter -eq 1 ]]; then
      if [[ "$line" =~ ^name:[[:space:]]*(.+)$ ]]; then
        fm_name="${BASH_REMATCH[1]//\'/}"
        fm_name="${fm_name//\"/}"
        fm_name="${fm_name// /}"
      fi
      if [[ "$line" =~ ^description:[[:space:]] ]]; then
        fm_desc_started=1
        val="${line#description: }"
        val="${val#>}"
        fm_description="$val"
      elif [[ $fm_desc_started -eq 1 && "$line" =~ ^[[:space:]]+ ]]; then
        fm_description="$fm_description $line"
      elif [[ $fm_desc_started -eq 1 ]]; then
        fm_desc_started=0
      fi
    fi
  done < "$skill_file"

  # 2d. name field must exist
  if [[ -z "$fm_name" ]]; then
    fail "[$skill_name] SKILL.md frontmatter missing 'name' field"
  fi

  # 2e. name must match directory name
  if [[ -n "$fm_name" && "$fm_name" != "$skill_name" ]]; then
    fail "[$skill_name] frontmatter 'name: $fm_name' does not match directory name '$skill_name'"
  fi

  # 2f. description must exist and be non-empty
  trimmed_desc="${fm_description//[[:space:]]/}"
  if [[ -z "$trimmed_desc" ]]; then
    fail "[$skill_name] SKILL.md frontmatter missing or empty 'description' field"
  fi

  # 2g. Body must contain numbered steps — either via "## Step N —" headings or numbered list items
  if ! grep -qE '^## Step [0-9]+ —' "$skill_file" && ! grep -qE '^\s*[0-9]+[.)]' "$skill_file"; then
    fail "[$skill_name] SKILL.md body contains no numbered steps (no '## Step N —' headings or numbered list items)"
  fi

done

# ─── 3. Every skill directory must appear in README ──────────────────────────
for dskill in "${dir_skills[@]}"; do
  found=0
  for rskill in "${readme_skills[@]}"; do
    [[ "$dskill" == "$rskill" ]] && found=1 && break
  done
  if [[ $found -eq 0 ]]; then
    fail "[$dskill] has a skills/ directory but is NOT listed in README.md Skills Index"
  fi
done

# ─── 4. Every README entry must have a skill directory ───────────────────────
for rskill in "${readme_skills[@]}"; do
  if [[ ! -d "$SKILLS_DIR/$rskill" ]]; then
    fail "[$rskill] is listed in README.md Skills Index but has no skills/ directory"
  fi
done

# ─── Result ──────────────────────────────────────────────────────────────────
if [[ $errors -gt 0 ]]; then
  echo "" >&2
  echo "Validation failed: $errors error(s) found." >&2
  exit 1
fi

echo "All skill validations passed."
exit 0

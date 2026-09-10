#!/usr/bin/env python3
"""Validate a drafted commit message against Conventional Commits + the 50/72 rule.

Usage:
    python validate_commit_message.py <path-to-message-file>
    python validate_commit_message.py -   # read from stdin

Checks:
  - Header line matches `<type>[(scope)][!]: <description>`
  - Header type is a recognized one (warning only -- custom types are allowed by the spec)
  - Header length: ideal <=50 chars (warning), hard cap 72 chars (error)
  - Blank line separates header from body, and body from footer block
  - Body lines wrap at <=72 chars (warning; long unbroken tokens like URLs are exempted)
  - Footer tokens look like `Token: value` or `Token #value`, and `BREAKING CHANGE` is
    spelled exactly that way if present
  - If `!` is used in the header, a `BREAKING CHANGE:` footer is present (and vice versa
    is fine either way per spec -- only the `!`-without-footer case is flagged)

Exit code is non-zero if any error-level issue is found. Warnings don't fail the run --
they're things to consider before showing the draft to the developer, not hard blockers.
"""
import re
import sys

KNOWN_TYPES = {
    "feat", "fix", "build", "chore", "ci", "docs", "style",
    "refactor", "perf", "test", "revert",
}

HEADER_RE = re.compile(r"^(?P<type>[a-zA-Z0-9_-]+)(\((?P<scope>[^)]+)\))?(?P<bang>!)?:\s(?P<desc>.+)$")
FOOTER_TOKEN_RE = re.compile(r"^(?P<token>[A-Za-z-]+|BREAKING CHANGE)(: | #)(?P<value>.+)$")

IDEAL_SUBJECT_LEN = 50
HARD_SUBJECT_LEN = 72
BODY_WRAP_LEN = 72


def read_message(path: str) -> str:
    if path == "-":
        return sys.stdin.read()
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def is_long_token_line(line: str) -> bool:
    """A line that's one long unbroken token (e.g. a URL) is exempt from the wrap check."""
    stripped = line.strip()
    return bool(stripped) and " " not in stripped


def validate(message: str) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    lines = message.rstrip("\n").split("\n")
    if not lines or not lines[0].strip():
        errors.append("Message is empty, or the header line is blank.")
        return errors, warnings

    header = lines[0]
    m = HEADER_RE.match(header)
    if not m:
        errors.append(
            f"Header does not match `<type>[(scope)][!]: <description>`: {header!r}"
        )
    else:
        commit_type = m.group("type")
        if commit_type.lower() not in KNOWN_TYPES:
            warnings.append(
                f"Type {commit_type!r} isn't one of the commonly recognized types "
                f"({', '.join(sorted(KNOWN_TYPES))}). Custom types are allowed by the "
                f"spec, but double-check this isn't a typo of a standard one."
            )
        if not m.group("desc").strip():
            errors.append("Header has no description after the colon.")
        elif m.group("desc")[0].isupper() and not m.group("desc").split()[0].isupper():
            warnings.append(
                "Description starts with a capital letter -- Conventional Commits "
                "convention is usually a lowercase, imperative start (e.g. 'add', not 'Add')."
            )

    header_len = len(header)
    if header_len > HARD_SUBJECT_LEN:
        errors.append(
            f"Header is {header_len} chars, over the {HARD_SUBJECT_LEN}-char hard cap. "
            f"Shorten the description or move detail into the body."
        )
    elif header_len > IDEAL_SUBJECT_LEN:
        warnings.append(
            f"Header is {header_len} chars, over the ideal {IDEAL_SUBJECT_LEN}-char target "
            f"from the 50/72 rule. Fine occasionally, but see if it can be tightened."
        )

    # Split into header / body / footer blocks on blank lines.
    if len(lines) > 1:
        if lines[1].strip() != "":
            errors.append("No blank line between the header and the body/footer.")

    rest = lines[1:]
    # Find a footer block: a trailing run of paragraphs where every non-blank line
    # matches the footer token pattern (or is a continuation/wrapped line of one).
    blocks: list[list[str]] = []
    current: list[str] = []
    for line in rest:
        if line.strip() == "":
            if current:
                blocks.append(current)
                current = []
        else:
            current.append(line)
    if current:
        blocks.append(current)

    footer_block: list[str] | None = None
    body_blocks = blocks
    if blocks:
        last = blocks[-1]
        if last and FOOTER_TOKEN_RE.match(last[0]):
            footer_block = last
            body_blocks = blocks[:-1]

    for block in body_blocks:
        for line in block:
            if len(line) > BODY_WRAP_LEN and not is_long_token_line(line):
                warnings.append(
                    f"Body line exceeds {BODY_WRAP_LEN} chars: {line[:60]!r}..."
                )

    breaking_footer_present = False
    if footer_block:
        for line in footer_block:
            if FOOTER_TOKEN_RE.match(line) is None and not line.startswith(" "):
                warnings.append(
                    f"Footer line doesn't look like `Token: value` or `Token #value`: {line!r}"
                )
            if line.startswith("BREAKING CHANGE:"):
                breaking_footer_present = True
            elif line.lower().startswith("breaking change") and not line.startswith("BREAKING CHANGE"):
                errors.append(
                    "Found a breaking-change footer that isn't spelled exactly "
                    "'BREAKING CHANGE:' -- this token is case-sensitive in the spec."
                )

    if m and m.group("bang") and not breaking_footer_present:
        warnings.append(
            "Header uses `!` to mark a breaking change, but no `BREAKING CHANGE:` "
            "footer was found. Consider adding one to explain what breaks and how to adapt."
        )

    return errors, warnings


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    message = read_message(sys.argv[1])
    errors, warnings = validate(message)

    if warnings:
        print("Warnings:")
        for w in warnings:
            print(f"  - {w}")
    if errors:
        print("Errors:")
        for e in errors:
            print(f"  - {e}")
    if not errors and not warnings:
        print("Message looks good: valid header, wrapping within 50/72, footers well-formed.")

    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())

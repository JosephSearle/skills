#!/usr/bin/env python3
"""Check that a plan.md traces back to its spec.md, requirement by requirement.

Usage:
    python check_plan_coverage.py docs/sdlc/<ISSUE-KEY>-<slug>
    python check_plan_coverage.py <path/to/spec.md> <path/to/plan.md>

Checks:
  - plan.md has the required frontmatter keys and `risk` is `routine` or `higher-risk`
  - plan.md has all five sections: Files that change, Order of work, Risks, Proof,
    Alternatives not taken
  - Every requirement (R1, R2, ...) in spec.md's Requirements section is cited by at least
    one step in Order of work AND at least one entry in Proof
  - Every R/C id the plan cites actually exists in spec.md (no citing requirements that
    aren't there)
  - Every area of concern (C1, C2, ...) in spec.md is mentioned in Risks
  - A concern whose line in spec.md says `Status: open` has a matching `BLOCKED on C<n>`
    somewhere in the plan (warning only -- an open concern might not touch implementation,
    but that should be a conscious call)

Exit codes: 0 = all checks pass (warnings allowed), 1 = coverage errors found,
2 = can't check (missing file, or spec.md has no numbered requirements to check against).
"""
import re
import sys
from pathlib import Path

PLAN_SECTIONS = [
    "files that change",
    "order of work",
    "risks",
    "proof",
    "alternatives not taken",
]
PLAN_FRONTMATTER_KEYS = [
    "status",
    "linked_spec",
    "linked_intent",
    "linked_issue",
    "risk",
    "approver",
    "created",
]
RISK_TIERS = {"routine", "higher-risk"}

HEADING_RE = re.compile(r"^##\s+(?P<title>.+?)\s*$")
# An id that *defines* an item: at the start of a line, optionally after a list marker
# and/or bold markers, e.g. "R1. ...", "- **R2**: ...", "1. R3 — ...".
DEFINE_RE = {
    "R": re.compile(r"^\s*(?:[-*]|\d+\.)?\s*\**(R\d+)\b"),
    "C": re.compile(r"^\s*(?:[-*]|\d+\.)?\s*\**(C\d+)\b"),
}
CITE_RE = {"R": re.compile(r"\b(R\d+)\b"), "C": re.compile(r"\b(C\d+)\b")}
BLOCKED_RE = re.compile(r"BLOCKED\s+on\s+(C\d+)", re.IGNORECASE)
OPEN_STATUS_RE = re.compile(r"status:\s*\**\s*open", re.IGNORECASE)


def split_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text
    parts = text.split("\n---", 1)
    if len(parts) != 2:
        return {}, text
    meta = {}
    for line in parts[0].splitlines()[1:]:
        if ":" in line and not line.startswith(" "):
            key, value = line.split(":", 1)
            meta[key.strip()] = value.strip()
    return meta, parts[1]


def sections(body: str) -> dict[str, str]:
    """Map lower-cased `## ` heading -> the text under it (until the next `## `)."""
    result: dict[str, list[str]] = {}
    current = None
    for line in body.splitlines():
        match = HEADING_RE.match(line)
        if match:
            current = match.group("title").strip().lower()
            result[current] = []
        elif current is not None:
            result[current].append(line)
    return {k: "\n".join(v) for k, v in result.items()}


def find_section(secs: dict[str, str], name: str) -> str | None:
    """Exact heading match first, then a heading that starts with the name."""
    if name in secs:
        return secs[name]
    for title, text in secs.items():
        if title.startswith(name):
            return text
    return None


def defined_ids(text: str, kind: str) -> list[str]:
    ids = []
    for line in text.splitlines():
        match = DEFINE_RE[kind].match(line)
        if match and match.group(1) not in ids:
            ids.append(match.group(1))
    return ids


def item_blocks(text: str, kind: str) -> dict[str, str]:
    """Map each defined id to its full item text, including wrapped continuation lines."""
    blocks: dict[str, list[str]] = {}
    current = None
    for line in text.splitlines():
        match = DEFINE_RE[kind].match(line)
        if match:
            current = match.group(1)
            blocks.setdefault(current, []).append(line)
        elif current is not None and line.strip():
            blocks[current].append(line)
        else:
            current = None
    return {k: " ".join(v) for k, v in blocks.items()}


def cited(text: str, kind: str) -> set[str]:
    return set(CITE_RE[kind].findall(text or ""))


def id_sort_key(ident: str) -> int:
    return int(ident[1:])


def resolve_paths(args: list[str]) -> tuple[Path, Path]:
    if len(args) == 1:
        folder = Path(args[0])
        return folder / "spec.md", folder / "plan.md"
    if len(args) == 2:
        return Path(args[0]), Path(args[1])
    print(__doc__)
    sys.exit(2)


def main(argv: list[str]) -> int:
    spec_path, plan_path = resolve_paths(argv)
    for path in (spec_path, plan_path):
        if not path.is_file():
            print(f"CANNOT CHECK: {path} not found")
            return 2

    _, spec_body = split_frontmatter(spec_path.read_text(encoding="utf-8"))
    plan_meta, plan_body = split_frontmatter(plan_path.read_text(encoding="utf-8"))
    spec_secs = sections(spec_body)
    plan_secs = sections(plan_body)

    requirements_text = find_section(spec_secs, "requirements") or ""
    concerns_text = find_section(spec_secs, "areas of concern") or ""
    requirements = defined_ids(requirements_text, "R")
    concerns = defined_ids(concerns_text, "C")

    if not requirements:
        print(
            "CANNOT CHECK: spec.md's Requirements section has no numbered requirements "
            "(R1, R2, ...). Older specs may predate numbering -- the plan should say which "
            "numbering it assigned, and the check has to be done by hand."
        )
        return 2

    errors: list[str] = []
    warnings: list[str] = []

    # Structure
    for key in PLAN_FRONTMATTER_KEYS:
        if key not in plan_meta:
            errors.append(f"plan.md frontmatter is missing `{key}`")
    risk = plan_meta.get("risk", "").strip().strip("'\"").lower()
    if "risk" in plan_meta and risk not in RISK_TIERS:
        errors.append(f"plan.md `risk` is `{risk}`; expected one of {sorted(RISK_TIERS)}")
    missing_sections = [s for s in PLAN_SECTIONS if find_section(plan_secs, s) is None]
    for name in missing_sections:
        errors.append(f"plan.md is missing the `## {name.capitalize()}` section")

    order_text = find_section(plan_secs, "order of work") or ""
    proof_text = find_section(plan_secs, "proof") or ""
    risks_text = find_section(plan_secs, "risks") or ""

    # Every requirement is planned and proved
    in_steps = cited(order_text, "R")
    in_proof = cited(proof_text, "R")
    for req in requirements:
        if req not in in_steps:
            errors.append(f"{req} is not cited by any step in Order of work")
        if req not in in_proof:
            errors.append(f"{req} has no entry in Proof")

    # Every citation points at something real
    for kind, known in (("R", requirements), ("C", concerns)):
        for ident in sorted(cited(plan_body, kind) - set(known), key=id_sort_key):
            errors.append(f"plan.md cites {ident}, which doesn't exist in spec.md")

    # Every concern is accounted for in Risks; open ones are visibly blocked
    in_risks = cited(risks_text, "C")
    blocked = {c.upper() for c in BLOCKED_RE.findall(plan_body)}
    for concern in concerns:
        if concern not in in_risks:
            errors.append(f"{concern} (area of concern) is not mentioned in Risks")
    for concern, block in item_blocks(concerns_text, "C").items():
        if OPEN_STATUS_RE.search(block) and concern not in blocked:
            warnings.append(
                f"{concern} is still open in spec.md but no step is marked "
                f"`BLOCKED on {concern}` -- confirm it really doesn't affect implementation"
            )

    print(f"spec: {spec_path}  ({len(requirements)} requirements, {len(concerns)} concerns)")
    print(f"plan: {plan_path}")
    for warning in warnings:
        print(f"  WARN  {warning}")
    for error in errors:
        print(f"  ERROR {error}")
    if errors:
        print(f"FAIL: {len(errors)} error(s), {len(warnings)} warning(s)")
        return 1
    print(f"OK: every requirement is planned and proved; {len(warnings)} warning(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

#!/usr/bin/env python3
"""Report where each change under docs/sdlc/ stands in the SDLC series, and what comes next.

Usage:
    python sdlc_status.py [docs/sdlc] [--base BRANCH]

For every change folder (docs/sdlc/<ISSUE-KEY>-<slug>/) it reads intent.md, spec.md and plan.md
and gives each one a state from git:
  missing      -- the file isn't there
  uncommitted  -- on disk, but not in any commit yet (new, or only staged)
  committed    -- committed on some branch, but not on the base branch yet
  accepted     -- on the base branch, i.e. merged. Same check sdlc-build uses:
                  `git log --oneline <base> -- <path>` is non-empty
  unknown      -- on disk, but acceptance can't be read (not a git repo, or no base branch)

The base branch is --base if given, else the remote's default (origin/HEAD), else local `main`,
else `master`. If the repo has a remote, `git fetch` first so merges on the remote are visible.

The series ends at plan.md: past a committed plan, the only next step is implementing it.

Exit codes: 0 = report printed, 2 = the docs/sdlc folder doesn't exist.
"""
import argparse
import re
import subprocess
import sys
from pathlib import Path

ARTIFACTS = ("intent.md", "spec.md", "plan.md")
TITLE_RE = re.compile(r"^#\s+(?:Intent|Spec|Plan):\s*(?P<title>.+?)\s*$", re.MULTILINE)
RISK_RE = re.compile(r"^risk:\s*['\"]?(?P<risk>[\w-]+)", re.MULTILINE)


def git(top: Path, *args: str) -> str | None:
    """Run a git command in `top`; return stripped stdout, or None if it failed."""
    try:
        result = subprocess.run(
            ["git", *args], cwd=top, capture_output=True, text=True, check=False
        )
    except FileNotFoundError:
        return None
    return result.stdout.strip() if result.returncode == 0 else None


def find_repo_top(path: Path) -> Path | None:
    top = git(path, "rev-parse", "--show-toplevel")
    return Path(top) if top else None


def find_base(top: Path, requested: str | None) -> tuple[str | None, str | None]:
    """Return (base ref, warning)."""
    if requested:
        if git(top, "rev-parse", "--verify", "--quiet", requested) is None:
            return None, f"--base {requested} isn't a ref in this repo"
        return requested, None
    remote_head = git(top, "symbolic-ref", "--short", "refs/remotes/origin/HEAD")
    if remote_head:
        return remote_head, None
    for name in ("main", "master"):
        if git(top, "rev-parse", "--verify", "--quiet", f"refs/heads/{name}") is not None:
            return name, None
    return None, "no base branch found (no origin/HEAD, main or master) -- pass --base"


def artifact_state(path: Path, top: Path | None, base: str | None) -> str:
    if not path.is_file():
        return "missing"
    if top is None:
        return "unknown"
    rel = path.resolve().relative_to(top.resolve()).as_posix()
    if base and git(top, "log", "--oneline", "-1", base, "--", rel):
        return "accepted"
    if git(top, "log", "--oneline", "-1", "--all", "--", rel):
        return "committed" if base else "unknown"
    return "uncommitted"


def read_title(folder: Path) -> str:
    for name in ARTIFACTS:
        path = folder / name
        if path.is_file():
            match = TITLE_RE.search(path.read_text(encoding="utf-8", errors="replace"))
            if match:
                return match.group("title")
    return folder.name


def read_risk(plan: Path) -> str | None:
    if not plan.is_file():
        return None
    match = RISK_RE.search(plan.read_text(encoding="utf-8", errors="replace"))
    return match.group("risk").lower() if match else None


def draft_or_pending(stage: str, artifact: str, state: str, title: str) -> tuple[str, str] | None:
    """Stage/next for an artifact that exists but hasn't been accepted yet, else None."""
    prefix = artifact.split(".")[0]
    if state == "uncommitted":
        return (
            f"{stage}: {artifact} drafted, not committed",
            f"commit it as `{prefix}: {title}` on a branch and open a PR -- the product "
            "owner's merge is the acceptance",
        )
    if state == "committed":
        return (
            f"{stage}: {artifact} awaiting acceptance",
            "product owner reviews the PR; merging it accepts this stage",
        )
    if state == "unknown":
        return (
            f"{stage}: can't tell whether {artifact} is accepted",
            f"confirm {artifact} has been merged to the default branch before moving on",
        )
    return None


def plan_stage(plan_state: str, risk: str | None, title: str, note: str) -> tuple[str, str]:
    if plan_state == "missing":
        return "Ready for Build" + note, "run sdlc-build to write plan.md"
    if plan_state == "uncommitted":
        stage = "Stage 3 (Build): plan.md drafted, not committed" + note
        if risk == "routine":
            return stage, (
                f"commit it as `plan: {title}` as the first commit on the implementation "
                "branch, before any code"
            )
        if risk == "higher-risk":
            return stage, (
                f"commit it as `plan: {title}` and get tech lead/architect approval on it "
                "(e.g. a plan-only PR) before implementation begins"
            )
        return stage, "set `risk:` (routine | higher-risk) in plan.md's frontmatter, then commit it"
    if plan_state == "unknown":
        return (
            "Stage 3 (Build): can't tell whether plan.md is committed" + note,
            "confirm plan.md is committed before implementation starts",
        )
    return (
        "Handed off: plan.md committed" + note,
        "implement from plan.md step by step; if the code diverges, update plan.md in the "
        "same commit (check coverage with sdlc-build's check_plan_coverage.py)",
    )


def classify(states: dict[str, str], risk: str | None, title: str) -> tuple[str, str]:
    intent, spec, plan = (states[name] for name in ARTIFACTS)

    if intent == "missing":
        if spec != "missing" or plan != "missing":
            return (
                "Incomplete: spec.md/plan.md exist without an intent.md",
                "run sdlc-plan to capture the intent these were built from",
            )
        return "Empty folder", "run sdlc-plan to capture the intent"
    pending = draft_or_pending("Stage 1 (Plan)", "intent.md", intent, title)
    if pending:
        return pending

    if spec == "missing":
        if plan == "missing":
            return "Ready for Design", "run sdlc-design to write spec.md"
        # sdlc-build allows planning straight from intent.md for small changes.
        return plan_stage(plan, risk, title, " (planned from intent.md, no spec)")
    pending = draft_or_pending("Stage 2 (Design)", "spec.md", spec, title)
    if pending:
        return pending

    return plan_stage(plan, risk, title, "")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("root", nargs="?", default="docs/sdlc", help="default: docs/sdlc")
    parser.add_argument("--base", help="base branch acceptance is checked against")
    args = parser.parse_args(argv)

    root = Path(args.root)
    if not root.is_dir():
        print(f"No {root} folder -- no changes have been captured yet.")
        print("next:  run sdlc-plan to capture the first intent")
        return 2

    top = find_repo_top(root)
    base, warning = (None, "not a git repo -- acceptance can't be checked")
    if top is not None:
        base, warning = find_base(top, args.base)

    folders = sorted(p for p in root.iterdir() if p.is_dir())
    print(f"{root}  (base: {base or 'none'})")
    if warning:
        print(f"  WARN  {warning}")
    if not folders:
        print("\nNo changes yet.")
        print("next:  run sdlc-plan to capture the first intent")
        return 0

    for folder in folders:
        states = {name: artifact_state(folder / name, top, base) for name in ARTIFACTS}
        risk = read_risk(folder / "plan.md")
        title = read_title(folder)
        stage, next_step = classify(states, risk, title)
        print(f"\n{folder.name} -- {title}")
        for name in ARTIFACTS:
            extra = f"   risk: {risk}" if name == "plan.md" and risk else ""
            print(f"  {name:<10} {states[name]}{extra}")
        print(f"  stage: {stage}")
        print(f"  next:  {next_step}")
    print(f"\n{len(folders)} change(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

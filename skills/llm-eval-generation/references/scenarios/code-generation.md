# Code Generation Eval Reference

Load this file when the code under test generates code: functions that return code strings,
use `exec()`, extract code blocks from LLM output, or implement any code generation pipeline.

---

## Failure Modes

- **Syntactically invalid code** — generated code cannot be parsed by the language interpreter
- **Semantically incorrect code** — code runs but produces wrong results
- **Insecure patterns** — SQL injection, command injection, hardcoded credentials, unsafe eval
- **Wrong language or framework assumptions** — code targets the wrong runtime, version, or API
- **Incomplete implementations** — generated code has placeholders, stubs, or missing logic
- **Dependency hallucination** — code imports packages that do not exist

---

## Required Metrics

| Metric | Definition | Tool |
|---|---|---|
| **pass@k** | Probability that ≥1 of k generated solutions passes all unit tests | Custom execution harness |
| **pass@1** | Single-shot correctness — most relevant for production quality gates | Custom |
| **Execution Success Rate** | Generated code runs without runtime errors | Sandboxed execution |
| **Test Pass Rate** | Fraction of unit tests passing for generated solution | Sandboxed execution |
| **Security Score** | Presence of known vulnerable patterns | Promptfoo, Bandit, ESLint security plugins |
| **Correctness vs. Ground Truth** | Semantic equivalence to a reference solution | LLM-as-judge |

> Execution-based evaluation is mandatory. Static analysis (BLEU, cosine similarity, or
> AST comparison) is insufficient — running the generated code against tests is the only
> reliable signal. A syntactically correct, test-passing solution is the minimum bar.

---

## pass@k Implementation

pass@k accounts for the stochastic nature of code generation. Use pass@1 for CI quality gates
and pass@k (k=3–5) for model capability assessment.

```python
# evals/eval_code_generation.py
import subprocess
import tempfile
import os
from typing import Callable

def run_in_sandbox(code: str, test_code: str, language: str = "python") -> bool:
    """
    Execute generated code against test code in an isolated subprocess.
    Returns True if all tests pass.

    WARNING: Always run in a sandbox with no network and restricted filesystem access.
    Use Docker/Podman for production sandboxing.
    """
    with tempfile.TemporaryDirectory() as tmp_dir:
        solution_path = os.path.join(tmp_dir, "solution.py")
        test_path = os.path.join(tmp_dir, "test_solution.py")

        with open(solution_path, "w") as f:
            f.write(code)
        with open(test_path, "w") as f:
            f.write(f"from solution import *\n{test_code}")

        result = subprocess.run(
            ["python", "-m", "pytest", test_path, "-v", "--tb=short"],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=tmp_dir,
        )
        return result.returncode == 0

def pass_at_k(
    generator_fn: Callable[[str], str],
    problem: str,
    test_code: str,
    k: int = 3,
) -> float:
    """Run generator k times and return fraction of solutions that pass tests."""
    results = [run_in_sandbox(generator_fn(problem), test_code) for _ in range(k)]
    return sum(results) / k

# Example usage
CODING_PROBLEMS = [
    {
        "description": "Write a function that reverses a linked list.",
        "test_code": """
def test_reverse_linked_list():
    head = ListNode(1, ListNode(2, ListNode(3)))
    result = reverse_linked_list(head)
    assert result.val == 3
    assert result.next.val == 2
    assert result.next.next.val == 1
""",
    },
]

def test_code_generation_pass_at_k():
    for problem in CODING_PROBLEMS:
        rate = pass_at_k(
            generator_fn=code_generator.generate,
            problem=problem["description"],
            test_code=problem["test_code"],
            k=3,
        )
        assert rate >= 0.8, \
            f"pass@3 = {rate:.2f} for problem: {problem['description'][:50]}"
```

---

## Sandboxed Execution (Production)

For production-grade code generation evaluation, run in a container with no network access
and restricted filesystem. Promptfoo supports sandboxed code evaluation natively.

```yaml
# evals/code-generation.promptfoo.yaml
description: "Code generation quality and security eval"

providers:
  - id: code-generator-api
    config:
      url: http://localhost:8080/generate

prompts:
  - "Write a Python function that {{task_description}}"

tests:
  - vars:
      task_description: "reverses a string"
    assert:
      - type: python
        value: |
          # Execute generated code in sandbox
          import subprocess, tempfile, os
          with tempfile.TemporaryDirectory() as d:
              with open(f"{d}/sol.py", "w") as f:
                  f.write(output)
              result = subprocess.run(
                  ["python", "-c", "from sol import *; assert reverse_string('hello') == 'olleh'"],
                  capture_output=True, cwd=d, timeout=10
              )
              return result.returncode == 0
      - type: not-contains
        value: "eval("
        metric: "No eval() calls (security)"
      - type: not-contains
        value: "exec("
        metric: "No exec() calls (security)"
```

---

## Security Scanning

Run security analysis on every generated code solution. Static analysis is a complement to
execution-based testing, not a replacement.

```python
# Python: Bandit
import subprocess

def scan_security(code: str) -> dict:
    with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False) as f:
        f.write(code)
        f.flush()
        result = subprocess.run(
            ["bandit", "-r", f.name, "-f", "json", "-ll"],
            capture_output=True, text=True,
        )
    return json.loads(result.stdout) if result.stdout else {}

def test_no_high_severity_security_issues():
    for problem in CODING_PROBLEMS:
        generated = code_generator.generate(problem["description"])
        report = scan_security(generated)
        high_severity = [
            r for r in report.get("results", [])
            if r["issue_severity"] == "HIGH"
        ]
        assert not high_severity, \
            f"High severity security issues found:\n" + \
            "\n".join(f"  - {r['issue_text']}" for r in high_severity)
```

---

## LLM-as-Judge for Code Quality

For subjective code quality (readability, idiom, design), use G-Eval:

```python
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCaseParams

code_quality_metric = GEval(
    name="Code Quality",
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
    criteria="The generated code is correct, readable, idiomatic, and free of common anti-patterns.",
    evaluation_steps=[
        "Read the problem description.",
        "Read the generated code.",
        "Check whether the code solves the stated problem.",
        "Check for obvious anti-patterns: magic numbers, deeply nested conditionals, duplicate logic.",
        "Check whether the code follows idiomatic conventions for its language.",
        "Score 1–10: 10 = correct, clean, idiomatic; 1 = incorrect or unreadable.",
    ],
    model="gpt-4o",
    threshold=0.7,
)
```

---

## Eval Dataset Requirements

Minimum 15 problems. Must include:
- Common algorithmic problems with clear correct solutions (happy path)
- Problems requiring specific library or framework usage (framework knowledge test)
- Problems where the naive solution has security vulnerabilities (security test)
- Problems with edge cases (empty input, zero, maximum values)
- Problems that require the generator to ask for clarification rather than guessing (abstention)
- Problems at varying difficulty levels (simple one-liners to multi-function implementations)

---

## CI Thresholds

| Metric | Minimum | Notes |
|---|---|---|
| pass@1 | 0.8 | CI quality gate — single-shot correctness |
| pass@3 | 0.9 | Model capability gate |
| High severity security issues | 0 | Zero tolerance — any high severity blocks deploy |
| Execution Success Rate | 0.9 | Code must run without crashing |

---

## Recommended Stack

| Layer | Tool | Reason |
|---|---|---|
| Execution eval | Custom sandbox (subprocess / Docker) | Only reliable signal for code correctness |
| Sandboxed eval pipeline | Promptfoo | Native sandboxed code eval support |
| Security scan | Bandit (Python), ESLint security plugin (TS) | Static vulnerability detection |
| Code quality | DeepEval G-Eval | LLM-as-judge for readability and idiom |
| Regression tracking | Braintrust | One-click production failure → regression test case |

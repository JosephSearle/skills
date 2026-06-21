# Terminal-Bench Reference — Deep Agents Code Evaluation

---

## Terminal-Bench 2.0 results (official)

Source: LangChain official blog (June 2026).

| Model | Trials | Score 1 | Score 2 | Mean |
|---|---|---|---|---|
| `claude-sonnet-4-5` via dcode | 2 | 44.9% | 40.4% | **42.65%** |

**Official characterisation:** "This baseline is on par with other implementations using the same model." — LangChain evaluation blog.

Terminal-Bench 2.0 tests 89 manually verified terminal tasks spanning file manipulation, shell scripting, code generation, build tooling, and environment setup.

---

## Evaluation setup

### Framework

Terminal-Bench 2.0 is evaluated via the `harbor` package with a `HarborSandbox` backend:

```bash
uv add harbor
```

```python
from harbor import HarborSandbox, TerminalBench

bench = TerminalBench(
    sandbox=HarborSandbox(),
    agent=dcode_agent,
    n_trials=2,
)
results = bench.run()
print(f"Mean score: {results.mean_score:.1%}")
```

### Scale setup used in the official evaluation

- Provider: **Daytona** (40 concurrent trials)
- 40 sandbox instances running in parallel
- Each trial is an independent, fresh Daytona workspace

```bash
# Run Terminal-Bench at scale on Daytona
dcode --sandbox daytona -n "$(cat terminal-bench-task.txt)"
# Or via harbor's built-in Daytona integration
```

---

## Using Terminal-Bench as your baseline

Before comparing custom configurations, reproduce the baseline:

1. Install dcode and harbor: `curl -LsSf https://langch.in/dcode | bash && uv add harbor`
2. Run 2 trials with `claude-sonnet-4-5` to confirm you match the published baseline (~42.65%)
3. Then introduce your configuration change and compare against your baseline

**Why 2 trials?** The published results show 4.5 percentage-point variance between trials (44.9% vs 40.4%). Run at least 2 trials and report the mean, not a single run.

---

## What Terminal-Bench 2.0 measures

| Category | Examples |
|---|---|
| File manipulation | Find and replace, batch rename, parse structured files |
| Shell scripting | Pipelines, process management, environment setup |
| Code generation | Write a script to solve a specific problem |
| Build tooling | Set up a build, fix compilation errors, run tests |
| Package management | Install, configure, and use CLI packages |
| Environment setup | Configure dotfiles, set up a development environment |

Tasks are self-contained and verified by running assertions in the same sandbox after the agent finishes.

---

## Interpreting scores

| Score | Interpretation |
|---|---|
| < 30% | Below par for the model — check agent configuration |
| 35–45% | On par with published Sonnet 4.5 baseline |
| 45–55% | Above baseline — configuration is improving task completion |
| > 55% | Strong configuration — investigate what's driving the improvement |

Scores vary significantly by model capability. Opus 4.7 is expected to outperform Sonnet 4.5; Haiku 4.5 is expected to underperform. Always compare within the same model family.

---

## HarborSandbox backend

`HarborSandbox` implements `SandboxBackendProtocol` and can be used directly with `create_deep_agent` for custom evaluations:

```python
from harbor import HarborSandbox
from deepagents import create_deep_agent

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    backend=HarborSandbox(),
)
```

This lets you evaluate any deepagents-based agent on Terminal-Bench tasks, not just the stock dcode CLI.

---
name: prompt-engineering
description: >
  Design and generate effective prompts for AI agents, graph nodes, pipelines, and multi-agent systems based on the node's role, reasoning scope, and position in a workflow. Use this skill whenever the user wants to create a system prompt, node prompt, or agent instruction — including ReAct agents, planner nodes, router/classifier nodes, executor nodes, critic/judge nodes, summarizer nodes, RAG retrieval nodes, tool-use agents, or any other dedicated LLM component in a graph or pipeline. Also triggers for: prompt chaining design, chain-of-thought prompt construction, few-shot example design, Tree of Thoughts scaffolding, self-consistency prompts, meta-prompting, and matching prompting technique to task complexity. If the user says "write a prompt for", "help me design a system prompt", "what technique should I use", "prompt for my [node/agent/step]", or mentions a node role in a graph or workflow — use this skill.
---

# Prompt Engineer Skill

A skill for designing high-quality, role-appropriate prompts for agents, graph nodes, and pipeline components — grounded in established prompting techniques mapped to reasoning complexity and node function.

---

## Core Philosophy

Every prompt should answer three questions before anything else is written:
1. **What is this node/agent's singular responsibility?** (role clarity)
2. **What reasoning depth does this task require?** (technique selection)
3. **What does this node receive as input and produce as output?** (interface contract)

A prompt is not just an instruction set — it is the "job description + operating procedure" for an LLM acting as a specialized component. Mismatched technique-to-task is the #1 cause of node failure in agentic graphs.

---

## Step 1 — Identify the Node Archetype

Before selecting a technique, identify which archetype the node falls into:

| Archetype | Role | Examples |
|-----------|------|---------|
| **Router / Classifier** | Decides which path or tool to invoke | Intent classifier, topic router, condition gate |
| **Planner** | Decomposes a goal into subtasks or a step sequence | Task planner, project decomposer |
| **Executor / Worker** | Carries out a specific, bounded task | Code writer, data extractor, formatter |
| **ReAct Agent** | Reasons + acts in a tool-use loop until goal is met | Search agent, research agent, QA agent |
| **Critic / Judge / Evaluator** | Scores, validates, or reflects on prior output | QA node, hallucination checker, self-consistency voter |
| **Summarizer / Synthesizer** | Compresses or integrates context | Summary node, RAG answer generator |
| **Memory / State Manager** | Maintains and updates working state | Scratchpad node, state tracker |
| **RAG Retrieval Orchestrator** | Decides what to retrieve and how to use it | RAG query planner, context packer |

> Read the archetype reference: `references/archetypes.md` for deeper prompt templates per archetype.

---

## Step 2 — Select the Reasoning Technique

Match reasoning depth to task complexity using this decision tree. Note: **Few-Shot examples are a modifier, not a technique** — they can be layered onto any technique below to improve accuracy when the task is domain-specific or format-sensitive.

```
Is the task a single, well-defined transformation with no ambiguity?
  └─ YES → Zero-Shot / Direct Instruction prompt
  └─ NO ↓

Does the task require numeric, algorithmic, or code-based computation?
  └─ YES → PAL (Program-Aided Language Models) — offload computation to a code interpreter
  └─ NO ↓

Does the task require factual grounding or commonsense context not in the prompt?
  └─ YES → Generate Knowledge Prompting — first generate relevant facts, then answer
  └─ NO ↓

Does the task require multi-step logical inference or arithmetic?
  └─ YES → Chain-of-Thought (CoT) — scaffold explicit reasoning steps
  └─ NO ↓

Does the task need to generalise across many tool-use task types from a shared library?
  └─ YES → ART (Automatic Reasoning and Tool-use) — auto-select task demonstrations + tools
  └─ NO ↓

Does the task require tool use, external lookup, or environment interaction?
  └─ YES → ReAct (Reason + Act) loop prompt
  └─ NO ↓

Does the task require exploring multiple candidate solutions with backtracking?
  └─ YES → Tree of Thoughts (ToT) prompt
  └─ NO ↓

Does the task require iterative self-improvement from its own failures?
  └─ YES → Reflexion loop (Actor → Evaluator → Self-Reflection → retry)
  └─ NO ↓

Does the task require self-verification or confidence boosting on a critical decision?
  └─ YES → Self-Consistency (sample N chains, majority-vote)
  └─ NO ↓

Is this a dedicated graph node with a fixed input/output contract?
  └─ YES → Prompt Chaining — tight I/O spec, no extraneous reasoning
```

**When to add Few-Shot examples to any of the above:**
- Output format is non-standard or complex
- Domain vocabulary is specialised
- Zero-shot accuracy is below acceptable threshold
- The node serves as a Router/Classifier (few-shot examples are almost always needed)

> Full technique reference: `references/techniques.md`

---

## Step 3 — Build the Prompt

Use the appropriate template from the sections below.

---

### Template A: Zero-Shot / Direct Instruction Node

**Use for:** Executors, formatters, simple transformers, classifiers with clear labels.

```
You are a [ROLE NAME].

Your task: [ONE SENTENCE DESCRIPTION OF THE TASK]

Input format: [DESCRIBE INPUT]
Output format: [DESCRIBE OUTPUT — be exact: JSON, markdown, plain text, etc.]

Constraints:
- [Constraint 1]
- [Constraint 2]

[OPTIONAL: Output structure example]
```

**Key principle:** No reasoning instructions needed. Tight, unambiguous. Output spec must be exact.

---

### Template B: Chain-of-Thought (CoT) Node

**Use for:** Planners, evaluators, complex classification, any node where the intermediate reasoning matters.

```
You are a [ROLE NAME].

Your task: [TASK DESCRIPTION]

Before producing your final answer, reason through the problem step by step inside <thinking> tags. 
Consider:
- [Reasoning dimension 1 — e.g., "What constraints apply?"]
- [Reasoning dimension 2 — e.g., "What are the edge cases?"]
- [Reasoning dimension 3 — e.g., "What is the best approach given the input?"]

Then produce your final answer in the format below.

Output format:
<thinking>
[Your step-by-step reasoning]
</thinking>

<answer>
[Your final output]
</answer>

Input:
{{input}}
```

**Key principle:** Scaffold the reasoning dimensions explicitly — don't just say "think step by step." Guide *what* to think about.

---

### Template C: ReAct Agent Prompt

**Use for:** Tool-using agents, research agents, QA agents, any node that must observe → reason → act in a loop.

Based on Yao et al., 2022 (ReAct framework), the core loop is:
`Thought → Action → Observation → Thought → ...→ Final Answer`

```
You are a [ROLE NAME] with access to the following tools:
- [tool_name]: [what it does and when to use it]
- [tool_name]: [what it does and when to use it]

Your goal: [GOAL DESCRIPTION]

Approach the task using the following loop until you reach a final answer:

Thought: Reason about what you know and what you need to find out next.
Action: Call one of the available tools with appropriate inputs.
Observation: Read the tool result and incorporate it into your reasoning.
... (repeat as needed)
Final Answer: [FORMAT SPEC]

Rules:
- Always reason before acting (never skip Thought)
- If a tool returns no useful information, adjust your search strategy
- Do not fabricate observations — only use what tools return
- Stop when you have enough information to answer confidently

Task: {{input}}
```

**Key principle:** The Thought step is mandatory — it prevents blind tool-calling and enables course correction. Use few-shot examples (1-2 trajectories) when the task domain is complex.

**Adding few-shot trajectories to ReAct:**
```
Example:
Question: [example question]
Thought 1: [reasoning]
Action 1: tool_name[input]
Observation 1: [result]
Thought 2: [updated reasoning]
Action 2: tool_name[input]
Observation 2: [result]
Thought 3: [conclusion]
Final Answer: [answer]
---
Now solve:
Question: {{input}}
```

---

### Template D: Tree of Thoughts (ToT) Node

**Use for:** Planning with alternatives, creative generation, problems where the first path may be wrong.

```
You are a [ROLE NAME] solving a problem that may have multiple valid approaches.

Task: {{input}}

Step 1 — Generate candidate approaches:
Propose [N=3] distinct strategies for solving this task. For each, briefly describe the approach and its trade-offs.

Strategy A: ...
Strategy B: ...
Strategy C: ...

Step 2 — Evaluate each approach:
Score each strategy on: [criterion 1], [criterion 2], [criterion 3] (scale 1-5).
Identify which strategy is most likely to succeed and why.

Step 3 — Execute the best strategy:
Carry out the selected strategy step by step.

Step 4 — Final answer:
[FORMAT SPEC]
```

**Key principle:** ToT is expensive — use only when the decision space is genuinely branching and the cost of a wrong first path is high.

---

### Template E: Prompt Chaining (Graph Node with Strict I/O)

**Use for:** Any node in a deterministic graph where input comes from a prior node and output feeds the next.

```
You are the [NODE NAME] in a [PIPELINE NAME] pipeline.

Your role: [ONE SENTENCE]
Your position: You receive output from [UPSTREAM NODE] and your output goes to [DOWNSTREAM NODE].

Input schema:
{{input_schema}}

Your task:
[PRECISE TASK DESCRIPTION — what to do with the input]

Output schema (you MUST conform exactly):
{{output_schema}}

Do not add commentary, explanation, or fields not in the output schema.
If the input is malformed or missing required fields, output:
{"error": "reason"}

Input:
{{input}}
```

**Key principle:** Strict schema adherence is the contract. Graph nodes must not "leak" free-form text into downstream structured inputs.

---

### Template F: Critic / Evaluator / Judge Node

**Use for:** QA nodes, self-reflection, hallucination detection, output scoring.

```
You are a [ROLE: e.g., "Quality Evaluator", "Fact Checker", "Output Critic"].

You will receive [DESCRIPTION OF WHAT YOU ARE REVIEWING].

Evaluate the input against the following criteria:

1. [Criterion name]: [What to look for] — Score 1-5
2. [Criterion name]: [What to look for] — Score 1-5
3. [Criterion name]: [What to look for] — Pass/Fail

For each criterion, provide:
- Score or verdict
- One sentence of reasoning
- (If failing) A specific suggestion for improvement

Then provide an overall verdict: PASS / NEEDS_REVISION / FAIL

Output format:
{
  "criteria": {
    "[criterion_1]": {"score": N, "reasoning": "...", "suggestion": "..."},
    ...
  },
  "overall": "PASS|NEEDS_REVISION|FAIL",
  "summary": "One sentence overall assessment"
}

Input to evaluate:
{{input}}
```

---

### Template G: Router / Classifier Node

**Use for:** Directing flow in a graph based on input content, intent, or type.

```
You are a [ROLE: e.g., "Request Router", "Intent Classifier"].

Classify the following input into exactly one of these categories:

Categories:
- [CATEGORY_A]: [Description of when to assign this]
- [CATEGORY_B]: [Description of when to assign this]
- [CATEGORY_C]: [Description of when to assign this]
- [UNKNOWN]: Use only if the input genuinely doesn't match any category

Rules:
- Output ONLY the category name, nothing else
- Do not explain your reasoning
- If borderline, choose the category that best describes the primary intent

Input:
{{input}}
```

**Key principle:** Routers must be deterministic. Strip CoT entirely — you want the single token classification, not a paragraph. Use few-shot examples if accuracy is below acceptable threshold.

---

### Template H: Generate Knowledge Node

**Use for:** Nodes that need domain grounding or commonsense context without a full RAG retrieval system. Two-stage: generate facts → use them to answer.

Based on Liu et al., 2022 (Generated Knowledge Prompting).

```
You are a [ROLE NAME].

Stage 1 — Knowledge Generation:
Before answering, generate [N=3–5] relevant facts or pieces of context about this topic that would help answer the question accurately.

Topic/Question: {{input}}

Knowledge:
1. [fact]
2. [fact]
3. [fact]

Stage 2 — Answer Generation:
Using only the knowledge you generated above, now answer the question.

Answer format: [FORMAT SPEC]

Answer:
```

**Key principle:** The self-generated knowledge stage acts as a grounding layer, reducing hallucination on commonsense and domain-specific tasks. For factual tasks requiring verified data, use RAG instead.

---

### Template I: Reflexion Loop Node

**Use for:** Iterative improvement scenarios — code generation, writing, planning — where the node must learn from its own prior failure within the same task.

Based on Shinn et al., 2023 (Reflexion framework). Three components: Actor (generates), Evaluator (scores), Self-Reflection (generates verbal feedback stored in memory).

**Actor Prompt:**
```
You are a [ROLE — e.g., "Code Writer", "Strategy Planner"].

Task: {{task}}

[If prior attempts exist:]
Previous attempts and reflections:
{{episodic_memory}}

Using the lessons from prior reflections (if any), produce your best attempt now.

Output: [FORMAT SPEC]
```

**Evaluator Prompt:**
```
You are an Evaluator. Score the following output on a scale of 0–10.

Task: {{task}}
Output to evaluate: {{output}}

Score: [0-10]
Verdict: PASS (≥7) | RETRY (<7)
```

**Self-Reflection Prompt (only runs if RETRY):**
```
You are a Self-Reflection Agent.

The following output failed to meet the required standard.

Task: {{task}}
Output: {{output}}
Evaluator feedback: {{evaluator_score_and_reason}}

Write a concise reflection (2–4 sentences) that explains:
1. What specifically went wrong
2. What should be done differently in the next attempt

Reflection:
```

**Key principle:** The Self-Reflection output must be stored in `episodic_memory` and passed back to the Actor on the next iteration. Cap retries at 3 to prevent infinite loops.

---

## Step 4 — Prompt Hardening Checklist

Before finalizing any prompt, verify:

- [ ] **Role is clear** — the LLM knows exactly what kind of agent it is
- [ ] **Single responsibility** — the node does one thing, not three
- [ ] **Input/output contract is explicit** — format, schema, or structure is specified
- [ ] **Reasoning technique matches complexity** — not over- or under-engineered
- [ ] **Edge cases handled** — what to do on bad input, ambiguity, or missing data
- [ ] **No hallucination invitations** — no "imagine" or open-ended fields for factual tasks
- [ ] **Constraints are stated, not implied** — "Do not X" beats hoping the model infers it
- [ ] **Temperature guidance (if relevant)** — deterministic nodes (routers, formatters) → temp 0; creative/brainstorm nodes → temp 0.7-1.0
- [ ] **Few-shot exemplars reviewed** — if used, examples cover edge cases and are domain-representative; biased examples are worse than no examples
- [ ] **Iteration limits set** — any looping node (ReAct, Reflexion, ToT) has a max-iteration guard at the orchestration layer

---

## Step 5 — Context Engineering for Graph Nodes

When the node is part of a larger graph or pipeline, also consider:

**What context should be injected into the prompt at runtime?**
- Prior node outputs (structured)
- Persistent memory / state
- Retrieved documents (RAG context)
- User-provided metadata

**Context injection pattern:**
```
[SYSTEM PROMPT — static, defines the role]

[DYNAMIC CONTEXT — injected at runtime]
<context>
  <prior_step>{{prior_output}}</prior_step>
  <retrieved_docs>{{rag_results}}</retrieved_docs>
  <state>{{working_memory}}</state>
</context>

[TASK — the actual current input]
<task>{{current_input}}</task>
```

Keep static (system) and dynamic (context + task) clearly separated. This makes the node easier to debug and iterate on.

---

## Quick Reference — Technique × Node Archetype Matrix

| Node Archetype | Primary Technique | Few-Shot? | Temperature |
|---------------|------------------|-----------|-------------|
| Router / Classifier | Zero-Shot | Almost always | 0 |
| Planner | CoT or ToT | Optional | 0.2–0.5 |
| Executor / Worker | Zero-Shot or Prompt Chain | Rarely | 0–0.3 |
| Executor (numeric/code) | PAL | Rarely | 0 |
| ReAct Agent | ReAct | For complex domains | 0.3–0.5 |
| ReAct Agent (multi-task) | ART | Built-in | 0.3–0.5 |
| Critic / Judge | CoT with structured output | Optional | 0 |
| Summarizer / RAG Generator | Zero-Shot or CoT | Rarely | 0.3 |
| Knowledge Enrichment | Generate Knowledge Prompting | Optional | 0.3–0.5 |
| Memory / State Manager | Prompt Chain (strict schema) | No | 0 |
| RAG Retrieval Orchestrator | ReAct or CoT | Optional | 0.2–0.4 |
| Iterative Improver | Reflexion loop | No | 0.3–0.5 |

---

## Reference Files

- `references/archetypes.md` — Deep-dive prompt templates per archetype with annotated examples
- `references/techniques.md` — Full technique explanations: Zero-Shot, Few-Shot, CoT, ReAct, ToT, Self-Consistency, Prompt Chaining, Meta-Prompting, Reflexion
- `references/examples/` — Complete worked examples for common graph node patterns (RAG pipeline, ReAct search agent, multi-agent planner-executor-critic)

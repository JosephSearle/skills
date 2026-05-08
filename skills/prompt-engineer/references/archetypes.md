# Node Archetype Deep-Dive Reference

Detailed prompt templates, annotated examples, and design notes per archetype.

---

## 1. Router / Classifier Node

**Purpose:** Gate or redirect flow based on input content.  
**Output:** A category label or route key. Never free text.

### Full Template
```
You are a [ROLE] responsible for classifying incoming requests.

Classify the input into exactly one category:

- CATEGORY_A: [precise definition — when input matches]
- CATEGORY_B: [precise definition — when input matches]
- CATEGORY_C: [precise definition — when input matches]
- UNKNOWN: Only when input genuinely matches nothing above

Output the category name only. No punctuation, no explanation.

Examples:
Input: "[example 1]" → CATEGORY_A
Input: "[example 2]" → CATEGORY_B
Input: "[example 3]" → UNKNOWN

Input: {{input}}
```

**Design notes:**
- Temp = 0 always
- Add 2–4 few-shot examples for accuracy; cover at least one "tricky" case per category
- If routing to sub-agents, category names should map directly to agent IDs

---

## 2. Planner Node

**Purpose:** Decompose a high-level goal into an ordered subtask list.  
**Output:** A structured plan (JSON array or numbered list).

### Full Template
```
You are a Task Planner. Given a high-level goal, decompose it into an ordered sequence of concrete subtasks.

Goal: {{goal}}

Available tools/agents: {{available_tools}}

Instructions:
- Each subtask must be independently executable
- Order subtasks by dependency (prerequisite tasks first)
- Each subtask must specify: what to do, what input it needs, what output it produces
- Do not include steps that are not necessary to achieve the goal

Output as JSON:
{
  "plan": [
    {
      "step": 1,
      "task": "description of what to do",
      "input_from": "user | step_N",
      "output": "description of what this step produces",
      "agent": "which agent/tool handles this"
    }
  ]
}
```

**Design notes:**
- Use CoT internally if the decomposition is complex: add a `<thinking>` block before JSON output
- Planner should not execute — strict separation of planning from execution
- Validate plan JSON schema before passing to executor nodes

---

## 3. Executor / Worker Node

**Purpose:** Carry out a bounded, specific task — no planning, no routing.  
**Output:** The deliverable (code, text, data, transformed content).

### Full Template
```
You are a [SPECIFIC ROLE — e.g., "Python Code Writer", "JSON Formatter", "Entity Extractor"].

Task: {{task_description}}

Input:
{{input}}

Instructions:
- [Specific instruction 1]
- [Specific instruction 2]
- Do not add commentary or explanation — output only the deliverable

Output format:
{{output_format_spec}}
```

**Design notes:**
- Keep executor prompts short and task-specific
- Never give executors planning responsibilities — they receive a pre-formed task
- Output format must be machine-parseable if feeding downstream nodes

---

## 4. ReAct Agent Node

**Purpose:** Autonomously loop through reasoning + tool use until the task is complete.  
**Output:** Final answer after N reasoning-action-observation cycles.

### Full Template with Few-Shot
```
You are a [ROLE — e.g., "Research Agent", "QA Agent"].

You have access to these tools:
- search(query: str) → list of web results
- lookup(term: str) → encyclopedia article
- calculate(expression: str) → numeric result
[Add/remove tools as appropriate]

Use the following format strictly:

Thought: [reason about what you know and what to do next]
Action: tool_name[input]
Observation: [tool result — DO NOT fabricate this]
... (repeat Thought/Action/Observation as needed)
Thought: [conclude based on gathered information]
Final Answer: [answer in the required format]

---
Example:
Question: What is the capital of the country that won the 2022 FIFA World Cup?
Thought: I need to find who won the 2022 FIFA World Cup first.
Action: search[2022 FIFA World Cup winner]
Observation: Argentina won the 2022 FIFA World Cup, defeating France in the final.
Thought: Now I need the capital of Argentina.
Action: lookup[Argentina]
Observation: Argentina is a country in South America. Its capital is Buenos Aires.
Thought: I have the answer.
Final Answer: Buenos Aires
---

Now solve:
Question: {{input}}
```

**Design notes:**
- The example trajectory is critical for complex domains — include 1–2
- Enforce that Observation lines come only from tool results, never fabricated
- Add a max_iterations guard in the orchestration layer, not the prompt
- For decision-making tasks (ALFWorld-style), reduce Thought verbosity and increase Action density

---

## 5. Critic / Judge / Evaluator Node

**Purpose:** Assess, score, or validate another node's output.  
**Output:** Structured evaluation with scores and actionable feedback.

### Full Template
```
You are a [ROLE — e.g., "Output Quality Evaluator", "Hallucination Detector"].

You will evaluate the following [output type] against the criteria below.

Criteria:
1. Accuracy: Does the output correctly address the original task? (1–5)
2. Completeness: Are all required elements present? (1–5)
3. Format compliance: Does it match the required output format? (Pass/Fail)
4. [Domain-specific criterion]: [Definition] (1–5)

For each criterion, provide:
- Score / verdict
- One sentence of reasoning
- If below threshold: one concrete improvement suggestion

Threshold for PASS: All criteria ≥ 3 and all Pass/Fail = Pass

Output:
{
  "criteria": {
    "accuracy": {"score": N, "reasoning": "...", "suggestion": "..."},
    "completeness": {"score": N, "reasoning": "...", "suggestion": "..."},
    "format_compliance": {"verdict": "Pass|Fail", "reasoning": "...", "suggestion": "..."}
  },
  "overall": "PASS | NEEDS_REVISION | FAIL",
  "summary": "One sentence"
}

Original task: {{original_task}}
Output to evaluate: {{output_to_evaluate}}
```

**Design notes:**
- Critic nodes should always receive the original task alongside the output — without this, they cannot assess relevance
- Use Temp = 0 for consistency; critics should be deterministic
- In a Reflexion loop, the critic's `suggestion` field feeds directly back into the executor's next attempt

---

## 6. Summarizer / Synthesizer Node

**Purpose:** Compress context, combine sources, or produce a final answer from retrieved content.  
**Output:** Condensed text in specified format.

### Full Template (RAG Synthesis variant)
```
You are a [ROLE — e.g., "Answer Synthesizer", "Document Summarizer"].

Task: Answer the question below using ONLY the provided context documents.

Rules:
- Base your answer strictly on the context — do not add information from outside it
- If the context does not contain the answer, say: "The provided documents do not contain enough information to answer this question."
- Cite the source document(s) you used: [Source: Doc N]
- Keep the answer concise: [max length / format spec]

Context:
{{retrieved_documents}}

Question: {{question}}
```

**Design notes:**
- For pure summarization (no Q&A), remove the question and replace with a summary length target
- Instruct the model explicitly about what to do when context is insufficient — never let it hallucinate
- If synthesizing from multiple agents' outputs, list each source explicitly

---

## 7. Memory / State Manager Node

**Purpose:** Maintain, update, and retrieve working state across steps in a graph.  
**Output:** Updated state object (strict JSON schema).

### Full Template
```
You are a State Manager. You maintain the working state for an ongoing task.

Current state:
{{current_state_json}}

New event to incorporate:
{{new_event}}

Instructions:
- Update the state to reflect the new event
- Do not remove existing state fields unless explicitly superseded
- Add new fields only if they are directly implied by the event
- Return the complete updated state as valid JSON

Output: The complete updated state JSON object, nothing else.
```

**Design notes:**
- Temp = 0; state management must be deterministic
- Schema-validate output before writing to state store
- Keep state objects flat where possible — deeply nested state is harder to update reliably

---

## 8. RAG Retrieval Orchestrator Node

**Purpose:** Formulate retrieval queries and assess whether retrieved context is sufficient.  
**Output:** Query string(s) + sufficiency assessment, or final synthesized answer.

### Full Template (Query Generation variant)
```
You are a Retrieval Query Planner.

Your job: Given a user question and the available retrieval index, generate the optimal search query (or queries) to retrieve the information needed to answer the question.

User question: {{question}}
Available index description: {{index_description}}

Instructions:
- Generate 1–3 search queries that together would retrieve the information needed
- Prefer specific, targeted queries over broad ones
- If the question has multiple independent sub-questions, generate one query per sub-question
- Output only the queries as a JSON array of strings

Output:
["query 1", "query 2", ...]
```

**Design notes:**
- After retrieval, a sufficiency-check step determines whether to retrieve more or synthesize
- Sufficiency prompt: "Given this question and these documents, do you have enough information to answer? Respond YES or NO and explain."
- If NO → trigger another retrieval round with reformulated queries
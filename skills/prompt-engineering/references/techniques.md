# Prompting Techniques Reference

A concise guide to each technique used in the prompt-engineer skill, covering when to use it, key mechanics, and pitfalls.

---

## Zero-Shot Prompting
**When:** Task is unambiguous, well-defined, and within the model's general capability.  
**Mechanics:** Direct instruction + output format. No examples, no reasoning scaffolding.  
**Pitfall:** Fails when the task has subtle constraints the model must infer.

---

## Few-Shot Prompting
**When:** Output format is non-standard, domain vocabulary is specialised, or zero-shot accuracy is insufficient. **Few-Shot is a modifier, not a standalone technique** — it layers onto any other technique (Few-Shot CoT, Few-Shot ReAct, etc.).  
**Mechanics:** Provide 2–6 input/output exemplars before the query. Quality > quantity. Cover edge cases.  
**Pitfall:** Biased or unrepresentative examples poison outputs. Vary exemplars to cover failure modes.

---

## Generate Knowledge Prompting
**Source:** Liu et al., 2022  
**When:** Task requires commonsense reasoning or domain context that isn't in the prompt, but full RAG retrieval is unnecessary or unavailable.  
**Mechanics:** Two stages — (1) prompt the model to generate N relevant facts about the topic, (2) use those self-generated facts as grounding context to answer the question.  
**Use case in graphs:** A knowledge enrichment node that precedes an executor, reducing hallucination on domain-specific or commonsense questions.  
**Pitfall:** Self-generated knowledge can itself be wrong. Use RAG instead when factual accuracy is critical.

---

## PAL (Program-Aided Language Models)
**Source:** Gao et al., 2022  
**When:** The task involves numeric computation, algorithmic logic, or structured data manipulation — anything where LLM arithmetic is unreliable.  
**Mechanics:** Prompt the model to express its reasoning as executable code (Python). The code is then run by an interpreter; the output of the interpreter becomes the final answer. The LLM handles reasoning; the interpreter handles computation.  
**Use case in graphs:** Executor nodes for math-heavy tasks, data transformations, or rule-based logic.  
**Pitfall:** Requires a code execution environment. Model must have sufficient coding ability.

---

## Chain-of-Thought (CoT)
**Source:** Wei et al., 2022  
**When:** Multi-step reasoning: math, logic, causal analysis, complex classification.  
**Mechanics:** Add "Let's think step by step" or scaffold explicit reasoning dimensions. Use `<thinking>` tags to separate reasoning from final answer.  
**Pitfall:** Can hallucinate confident-sounding wrong reasoning chains. Pair with self-consistency for high-stakes nodes.

---

## Self-Consistency
**When:** High-stakes decisions where one CoT chain may be unreliable.  
**Mechanics:** Sample N reasoning chains (e.g., 5), then majority-vote or select the most common final answer.  
**Pitfall:** Expensive. Use only at critical decision points in a graph.

---

## Prompt Chaining
**When:** Complex task that must be decomposed into sequential sub-tasks, each with its own I/O contract.  
**Mechanics:** Output of node N becomes structured input to node N+1. Keep each node's prompt minimal — it doesn't need to know the full graph.  
**Pitfall:** Schema drift between nodes. Always specify and validate I/O schemas at handoff points.

---

## ART (Automatic Reasoning and Tool-use)
**Source:** Paranjape et al., 2023  
**When:** A tool-using agent must handle many different task types, and hand-crafting demonstrations for each is impractical. ART automates the selection of relevant reasoning+tool-use demonstrations from a shared task library.  
**Mechanics:** Given a new task, ART selects the most relevant multi-step reasoning and tool-use demonstrations from a task library. At inference time, generation pauses when a tool is called, integrates the tool output, then resumes. Humans can optionally correct or extend the task library to improve performance.  
**Difference from ReAct:** ReAct uses hand-crafted, task-specific few-shot trajectories. ART automatically selects from a library — better for generalist agents across many task types.  
**Pitfall:** Requires maintaining a curated task library. Quality of demonstrations in the library directly determines output quality.

---

## ReAct (Reason + Act)
**Source:** Yao et al., 2022  
**When:** Tool-using agents, information retrieval loops, environments where the agent must observe results and update plans.  
**Core loop:** Thought → Action → Observation → Thought → ... → Final Answer  
**Pitfall:** Without explicit Thought steps, the agent degrades to blind tool-calling. Enforce Thought as mandatory.

---

## Tree of Thoughts (ToT)
**Source:** Yao et al., 2023; Long, 2023  
**When:** Problems where the first approach may be wrong and backtracking is valuable: planning, puzzle-solving, open-ended strategy.  
**Mechanics:** Generate N candidate strategies → evaluate each → select best → execute.  
**Pitfall:** High token cost. Only use when branching decisions are genuinely consequential.

---

## Reflexion
**Source:** Shinn et al., 2023  
**When:** Iterative improvement loops where the agent must learn from its own failure within a task (code debugging, planning revision, writing improvement).  
**Mechanics:** Three-component loop:
  1. **Actor** — generates an attempt, informed by episodic memory of prior reflections
  2. **Evaluator** — scores the attempt (pass/fail or numeric)
  3. **Self-Reflection** — if failing, generates verbal feedback stored to episodic memory
  The Actor reads episodic memory on the next iteration.  
**Pitfall:** Can get stuck if Evaluator or Self-Reflection prompts are poorly calibrated. Cap iterations (max 3).

---

## Meta-Prompting
**When:** The prompt itself needs to be generated dynamically, or an orchestrator must reason about how to instruct a downstream worker.  
**Mechanics:** A "meta" prompt instructs the model to generate the prompt for a downstream task before executing it.  
**Use case in graphs:** Orchestrator node that writes prompts for worker nodes based on dynamic task descriptions, rather than using static templates.

---

## RAG (Retrieval-Augmented Generation)
**When:** The task requires factual grounding beyond the model's training data.  
**Mechanics:** Retrieved documents are injected into context before the generation prompt. The node prompt must explicitly instruct the model to ground answers in retrieved content and flag when context is insufficient.  
**Pitfall:** "Lost in the middle" — models attend poorly to context in the middle of long documents. Put the most important context first or last.

---

## Graph Prompting
**When:** The problem has inherent graph structure (knowledge graphs, dependency graphs, network analysis).  
**Mechanics:** Encode graph nodes/edges explicitly in the prompt. Guide traversal or reasoning over graph structure.  
**Use case:** Knowledge graph QA nodes, dependency resolution planners.
---
name: prompt-engineering
description: 'Drafts, restructures, or hardens a prompt (system prompt, user prompt, or tool/agent instruction) for Claude using Anthropic''s own official prompt-engineering techniques: being clear and direct, adding context, multishot examples, XML tag structuring, role prompting, chain-of-thought/thinking, prompt chaining, output-format control, and prompt-level guardrail hardening against hallucination, inconsistency, jailbreaks/prompt injection, and prompt leak. Use whenever someone wants to write a new prompt, improve or rewrite an existing one, fix a prompt that is producing unreliable/wrong/inconsistent output, asks "how do I get Claude to...", wants a system prompt for an assistant or chatbot persona, needs a prompt hardened against jailbreaks or leaking its instructions, or is deciding which prompting technique fits their situation -- even if they never say "prompt engineering" by name. This skill is about writing the prompt text itself; once a prompt exists and needs to be measured or compared against alternatives, hand off to the prompt-evaluation skill.'
summary: Drafts and hardens Claude prompts using Anthropic's own official prompt-engineering techniques and guardrail guidance.
---

# Prompt Engineering

Anthropic's own docs define prompt engineering plainly: "taking a prompt you've written and improving it to get more reliable, higher-quality outputs." That's the whole job here -- not cleverness for its own sake, but closing the gap between what a prompt says and what Claude actually needs to hear to do the task well. Everything in this skill is drawn directly from Anthropic's official prompt-engineering documentation and prompting course, not general prompting folklore -- when in doubt, prefer the technique and terminology below over anything picked up elsewhere.

## Before writing a prompt: know what "good" means

Anthropic's own guidance is explicit that prompt engineering doesn't start with writing text -- it starts with knowing what you're aiming for: a clear **success criteria**, a way to test against it, and a first draft to improve. If the user hasn't said what "working" looks like for this prompt (what a good output contains, what a bad one looks like, any hard constraints), ask before diving into technique -- a prompt polished against the wrong target is wasted effort. Once there's a real first draft and a way to tell if it's working, that's exactly where the **prompt-evaluation** skill picks up: it turns "does this feel right" into a measured score you can improve against. Point the user to it once a draft exists, rather than trying to build an eval loop from inside this skill.

Also worth surfacing early, per Anthropic's own caveat: **not every problem is a prompting problem.** If what's actually wrong is latency or cost, the fix is usually a different model, not cleverer prompt text (see the Latency note near the end of this file). Don't force a prompt-engineering solution onto a model-selection problem.

## The core techniques

Anthropic names six: **Clarity, Examples, XML structuring, Role prompting, Thinking, and Prompt chaining.** Use as many as the task actually calls for -- a one-line utility prompt doesn't need all six, but a production system prompt for an agent usually benefits from most of them.

### 1. Be clear and direct

The single highest-leverage move, and the first thing to fix in almost any underperforming prompt. Anthropic's own test: **show the prompt to a colleague with minimal context and ask them to follow it -- if they'd be confused, Claude will be too.**

- Use instructions, not questions. Start with a direct action verb: "Write," "Create," "Generate," "Identify" -- not "Can you tell me about..." or "I was wondering...".
- State exactly what you want, including format, length, and any constraints, rather than leaving them implicit.
- Use numbered lists or bullets when the task has sequential steps.

Weak → strong, from Anthropic's own examples:
- Weak: `"I need to know about those things people put on their roofs that use sun - those solar panel things"`
  Strong: `"Write three paragraphs about how solar panels work."`
- Weak: `"Create an analytics dashboard"`
  Strong: `"Create an analytics dashboard. Include as many relevant features and interactions as possible. Go beyond the basics to create a fully-featured implementation."`

This is also where **tool-use instructions** live for agents: "Can you suggest some changes...?" only gets suggestions; "Change this function to improve its performance" gets action. If the prompt is meant to make Claude *act* rather than *advise*, say so directly.

### 2. Add context, don't just instruct

An instruction without the reason behind it is brittle -- Claude (and any reader) generalizes better when it knows *why*. Anthropic's example:
- Weak: `"NEVER use ellipses"`
- Strong: `"Your response will be read aloud by a text-to-speech engine, so never use ellipses since the text-to-speech engine will not know how to pronounce them."`

This matters more than it looks: a bare constraint gets followed narrowly or inconsistently; a constraint with its motivation attached gets applied correctly to cases you didn't explicitly list.

### 3. Use examples (multishot / few-shot prompting)

Anthropic calls this "one of the most effective prompt engineering techniques" you have. Examples do something instructions alone can't: they show Claude the *shape* of a correct answer, which is often faster to communicate than describing it in prose -- especially for edge cases, ambiguous inputs (sarcasm, mixed sentiment), or a specific output structure like JSON.

Three qualities every example set should have -- Anthropic's own criteria:
- **Relevant**: mirror your actual use case, not a generic stand-in.
- **Diverse**: cover edge cases and the range of real inputs, so Claude doesn't overfit to one narrow pattern.
- **Structured**: wrapped in XML tags so Claude can tell where an example starts and ends, separate from the live task.

**Use 3-5 examples for best results.** One example ("one-shot") can establish a pattern for a simple case; use several ("multi-shot") when inputs vary or edge cases matter. Structure each with tags like `<example>`, or paired `<sample_input>`/`<ideal_output>` tags:

```
<example>
<sample_input>Oh yeah, I really needed a flight delay tonight!</sample_input>
<ideal_output>Negative</ideal_output>
</example>
```

Two refinements worth doing when you have the material for them:
- **Source examples from your own evals.** If you've already run an evaluation (see prompt-evaluation), pull the input/output pairs that scored highest and use those verbatim as examples -- they're proven-good, not hypothetical.
- **Explain why an example is good**, not just the raw pair -- e.g. "This example is well-structured, provides detailed information, and aligns with the stated goal." A single sentence of rationale next to an example teaches the pattern faster than the example alone.

### 4. Structure prompts with XML tags

Claude can struggle to tell which pieces of a long or multi-part prompt belong together without explicit boundaries. XML tags fix that -- and the value scales with prompt complexity: **you might not see dramatic improvement on a simple one-liner, but tags become increasingly valuable as prompts grow more content, more sections, or more data types mixed together (instructions + code + documents, say).**

Rules that matter:
- Use **consistent, descriptive tag names** — `<sales_records>` or `<athlete_information>`, not a generic `<data>`.
- **Nest tags** to reflect real hierarchy rather than flattening everything.
- Reuse the same tag name for the same kind of thing every time it appears in a prompt, so Claude can pattern-match across occurrences.

```
<athlete_information>
- Height: 6'2"
- Weight: 180 lbs
- Goal: Build muscle
- Dietary restrictions: Vegetarian
</athlete_information>

Generate a meal plan based on the athlete information above.
```

**Long-context prompts (20k+ tokens)** get three specific rules from Anthropic, worth calling out because they're easy to get backwards:
- Put the long-form data (documents, transcripts, code) **at the top of the prompt**, above your instructions and query. Anthropic's own finding: queries placed at the end can improve response quality by up to 30%.
- Structure multi-document input with `<documents>`/`<document index="N">` tags, including a `<source>` for each.
- For grounding, ask Claude to **quote the relevant parts of the source before answering** -- this is both a consistency technique and (see below) a hallucination-reduction technique.

### 5. Give Claude a role (role prompting)

Setting a role in the **system prompt** focuses tone and behavior for the whole interaction, more reliably than restating "be professional" inside every user message:

```python
system="You are a helpful coding assistant specializing in Python."
```

Use this when the task has a persona, a domain focus, or a consistent register that should hold across turns -- not as decoration on a one-off prompt.

### 6. Thinking (chain-of-thought reasoning)

Two related but distinct things live under this heading:

- **Adaptive thinking** (the modern default, controlled via an `effort` parameter): Claude decides dynamically how much internal reasoning a task needs. For this, Anthropic's best-practice tip is to **prefer general instructions over prescriptive step-by-step ones** -- "think thoroughly" often outperforms a hand-written list of steps, because it lets Claude apply judgment rather than following a script that may not fit every input.
- **Manual chain-of-thought** (for models/situations without adaptive thinking, or where you want the reasoning visible): have Claude reason inside `<thinking>` tags before giving a final answer inside `<answer>` tags. This is also the standard pattern for **LLM-graded evaluations** — see prompt-evaluation's "Encourage Reasoning" tip, which is the same mechanism applied to grading rather than task-solving.

Either way, two techniques generalize well:
- Show reasoning patterns via multishot examples that themselves contain `<thinking>` blocks, rather than only describing the reasoning style in prose.
- Ask Claude to **self-check its answer against the stated criteria before finishing** -- catches a class of error that "just answer" prompts miss.

### 7. Prompt chaining

For a task with genuinely separable sub-tasks, split it into multiple prompts run in sequence rather than one large prompt trying to do everything at once. Anthropic's own framing: each sub-task gets Claude's full attention when it isn't sharing space with three other things, which is both a **quality** technique (see "Chain Prompts for Complex Tasks" below) and an **agentic-systems** technique for long-horizon, multi-step work. Use this when a single prompt's instructions are starting to fight each other, or when a later step genuinely depends on verifying an earlier one before proceeding.

## Controlling output format

A separate but related concern from *what* Claude says is *how* it's shaped. Anthropic's core rule here generalizes across every formatting problem: **tell Claude what TO do, not what NOT to do.**

- Weak: `"Do not use markdown."`
- Strong: `"Your response should be composed of smoothly flowing prose paragraphs."`

Practical techniques:
- Use XML tags to mark exactly which section of the response is the deliverable (e.g. wrap the final answer in `<answer>` so it's unambiguous which part to extract).
- Match your own prompt's style to the output style you want -- a prompt written in terse bullet fragments tends to produce terse bullet output, and vice versa.
- For structured output (JSON, a fixed template), **show the exact target structure** rather than describing it abstractly -- see "Increase Consistency" below.
- Remember Claude counts tokens, not words: asking for an exact word count is unreliable; asking for a paragraph or sentence count is not.

## Hardening a prompt: guardrail techniques

These are Anthropic's own guidance for four specific failure modes, and every technique below is genuinely prompt-level text you write into the prompt itself (as opposed to infrastructure like classifiers, sandboxing, or output filtering, which are noted as **not** prompt-engineering when they come up). Reach for these when the user's problem is specifically "Claude makes things up," "the format keeps changing," "someone could get this to say something it shouldn't," or "this prompt leaked."

### Reduce hallucinations

- **Allow Claude to say "I don't know."** Give explicit permission and a specific fallback phrase: *"If you're unsure about any aspect or if the report lacks necessary information, say 'I don't have enough information to confidently assess this.'"* An instruction to always give a confident answer is itself a cause of confabulation.
- **Ground responses in direct quotes.** For long documents, have Claude first extract the exact, word-for-word supporting quotes (or state "No relevant quotes found"), then answer using only those quotes, referencing them by number.
- **Verify with citations.** Require a supporting quote/source for every claim; after drafting, have Claude check each claim against its citation and retract (mark with empty `[]` brackets) anything unsupported.
- Lighter-weight variants worth naming to the user rather than fully spelling out: chain-of-thought verification (reason step by step before answering), best-of-N verification (run the prompt more than once and compare), iterative refinement (chain a follow-up prompt asking Claude to verify its own prior answer), and external knowledge restriction (explicitly instruct Claude to use only the provided documents, not general knowledge).
- These reduce hallucination significantly but don't eliminate it -- say so plainly rather than promising a hallucination-proof prompt, especially for high-stakes use cases.

### Increase consistency

Six techniques, in order of how often you'll reach for them:

1. **Specify the desired output format precisely** — name the exact keys/structure you want, not "return it as JSON."
2. **Constrain with full examples**, not abstract instruction — a complete example output is more effective than describing the shape in prose (this is the same "Examples" technique above, applied specifically to format-locking).
3. **Chain prompts for complex tasks** — split so each sub-task gets full attention, rather than asking for five things in one shot and getting five inconsistently-formatted things back.
4. **Use retrieval for contextual consistency** — ground a chatbot/knowledge-base assistant in a fixed `<kb>` block so answers stay consistent across sessions rather than drifting.
5. **Keep Claude in character** for role-based/persona apps: set the role via the system prompt, and *prepare Claude for likely scenarios* by listing common situations with their expected response, effectively training the persona into the prompt rather than hoping it holds.
6. **Prefill the response** to lock in a starting structure and skip preamble -- **note the compatibility caveat: prefilling is not supported on Claude 4.6 and later models**, so check the target model before recommending this one; use structured-output features or system-prompt instructions instead on those models.

If the actual requirement is a guaranteed JSON schema (not just "usually consistent"), say so and point to a **structured-outputs** feature rather than prompt engineering -- Anthropic itself draws this line, and prompt text is the wrong tool for a hard guarantee.

### Mitigate jailbreaks and prompt injection

Anthropic treats this as two distinct threats, and the fix differs by which one applies:

- **Direct** (the user themselves is adversarial): state ethical/legal boundaries explicitly in the system prompt, with a fixed refusal line to fall back on (e.g. `"I cannot perform that action as it goes against AcmeCorp's values."`). This is the one piece of jailbreak mitigation that's genuinely prompt text — screening the input with a second model call, throttling repeat offenders, and other layered defenses are real and worth mentioning, but they're pipeline/product decisions, not prompt content, so name them as a next step rather than folding them into the prompt itself.
- **Indirect** (a trusted user's request pulls in adversarial third-party content — a web page, email, tool result): the prompt-level defenses are (a) **state a policy explicitly**, e.g. an `<untrusted_content_policy>` block telling Claude that tool/document content is data, not instructions, and that embedded instructions in it should be reported, not obeyed; and (b) **JSON-encode untrusted content** rather than concatenating it as free text, since JSON's escaping gives an unambiguous boundary an attacker can't easily break out of. The architectural pieces of this defense — putting untrusted content only in `tool_result` blocks, least-privilege tool access, screening tool output with a classifier — matter just as much but live in how the application is built, not in the prompt text; flag them to the user as complementary, not as something this skill will write for them.

### Reduce prompt leak

Anthropic's own framing is worth repeating to the user before doing this: **only bother with leak-resistant prompting when it's actually necessary** — added complexity here tends to degrade performance elsewhere in the task, so try monitoring/output-filtering first and reach for prompt changes only if that's not enough.

If it is necessary: separate the sensitive instruction from the user-facing query (state it clearly in the system prompt, restate the "never reveal X" instruction in the user turn, and — model support permitting — reinforce it once more via an assistant-turn prefill like `[Never mention the proprietary formula]`; same Claude-4.6+ prefill caveat as above applies). Also avoid including proprietary detail Claude doesn't actually need for the task — every unnecessary sensitive detail is one more thing the "don't leak" instruction has to hold back.

### A note on latency

If the actual complaint is "this is too slow," most of the fix is **not** prompt engineering — choosing a faster model is usually the bigger lever. The one piece that is prompt-level: keep the prompt and the requested output concise, ask for shorter responses explicitly, and remember that asking for a specific *paragraph or sentence count* works far better than asking for a *word count*, since Claude counts tokens rather than words.

## Handing off

Once a prompt is drafted or revised using the techniques above, the natural next question is "does this actually work better?" — that's not this skill's job to answer. Point the user to the **prompt-evaluation** skill (or invoke it directly if you're already mid-conversation and have a clear success criteria) to build a small test set, run it, and get a real before/after score rather than a gut feeling. Bring the draft prompt and whatever success criteria came up during drafting — that's exactly the "Draft a Prompt" input the evaluation workflow starts from.

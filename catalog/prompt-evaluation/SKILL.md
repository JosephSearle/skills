---
name: prompt-evaluation
description: 'Turns "does this prompt feel like it works" into a measured answer by defining success criteria, building an eval dataset, running a prompt against it, and grading the results (code-based, model-based, or human), following Anthropic''s own official evaluation workflow -- then feeding the results back into a revised prompt. Use whenever someone wants to test, evaluate, benchmark, or score a prompt; compare two prompt versions objectively; build a test set for an LLM-based feature; asks "how do I know if my prompt is actually good", "how do I grade Claude''s output", or "did that change actually help"; or has a prompt that works on the examples they tried but they are not confident it will hold up in production. This is about measuring an existing prompt draft, not writing one from scratch -- if there is no draft yet, or the prompt itself needs restructuring, start with the prompt-engineering skill and come back here once there is something concrete to test.'
summary: Builds and runs a real eval (success criteria, test dataset, grading) for a Claude prompt, following Anthropic's official evaluation workflow.
---

# Prompt Evaluation

Anthropic draws a clean line between two different jobs: **prompt engineering** is "crafting effective prompts using techniques like multishot prompting and XML tags." **Prompt evaluation** is "measuring their effectiveness through automated testing" instead of just eyeballing a few outputs and hoping. This skill is the second job. If the user needs help writing or restructuring the prompt itself, that's the **prompt-engineering** skill -- the two are meant to be used together, in a loop, not as a one-time handoff.

## Why this is worth doing instead of skipping

Anthropic names the temptation directly and calls it a trap: test a prompt once, or a few times against corner cases you thought of, and assume it's good enough. Both "carry significant risk of breaking in production," because **when a prompt is deployed, users interact with it in ways you never anticipated.** The alternative -- a real evaluation pipeline with objective metrics -- costs more up front but pays it back by catching weaknesses before they're production incidents, letting you compare prompt versions on actual numbers instead of impressions, and giving you something concrete to iterate against. If the user says something like "I tried it on a few examples and it seemed fine," that's exactly the situation this skill exists for -- don't just take their word for "fine," offer to build the few extra pieces that turn a hunch into a number.

## Step 1 — Define success criteria

Before building any test, pin down what "good" actually means for this prompt. Anthropic's four qualities for a usable success criterion:

- **Specific** — "accurate sentiment classification," not "good performance."
- **Measurable** — a quantitative metric or a well-defined qualitative scale. Anthropic's own example of the difference: *bad* — "Safe outputs"; *good* — "Less than 0.1% of outputs out of 10,000 trials flagged for toxicity by the content filter."
- **Achievable** — grounded in a real benchmark, a prior experiment, or expert judgment about what's realistic, not an arbitrary aspirational number.
- **Relevant** — matched to what the application actually needs. Citation accuracy matters enormously for a medical assistant and much less for a casual chatbot; don't import a criterion just because it sounds rigorous.

Most real prompts need **more than one** criterion at once. Anthropic's own common categories, useful as a checklist so nothing important gets missed: **task fidelity, consistency, relevance and coherence, tone and style, privacy preservation, context utilization, latency, price.** Not every prompt needs all eight — pick the ones that actually matter for this use case, and ask the user if it's unclear which do.

## Step 2 — Build the eval

Three design principles, straight from Anthropic's own guidance, apply regardless of grading method:

1. **Be task-specific.** The eval's inputs should mirror the real distribution of what production will actually throw at the prompt — and deliberately include edge cases (sarcasm, typos, mixed intent, irrelevant tangents, adversarial input), not just the easy cases that already work.
2. **Automate when possible.** Favor questions/formats that can be graded automatically — multiple-choice, exact string match, code-graded, LLM-graded — over anything that requires a human to sit and read every response.
3. **Prioritize volume over quality.** More test cases with slightly noisier automated grading beats fewer test cases with painstaking hand-grading. Breadth catches more of the "ways users interact with it that you never anticipated" than depth on a handful of cases does.

**The canonical workflow** (Anthropic's own five-step loop — this is the shape every eval you build should follow):

1. **Draft a Prompt** — the prompt template under test (this is what the prompt-engineering skill produces).
2. **Create an Eval Dataset** — assemble representative sample inputs. These can be written by hand, or generated with Claude's help from a small seed set — genuinely useful when hand-writing hundreds of cases isn't practical. Datasets range from tens of records during development to potentially thousands for a final validation pass; keep it small (2-3 cases) while iterating quickly, and expand before trusting a final number.
3. **Feed Through Claude** — merge each dataset input into the prompt template and run it.
4. **Feed Through a Grader** — score each output, conventionally on a **1-10 scale, where 10 is high quality and 1 is poor** (see Step 3 for exactly how).
5. **Change Prompt and Repeat** — revise the prompt based on what the grades and reasoning reveal, then rerun the whole loop. This step is where you hand back to prompt-engineering: a low score on "format" points at the Increase Consistency techniques, a low score on factual grounding points at Reduce Hallucinations, and so on — the failure category tells you which technique to reach for next, rather than guessing.

Expect the first score to be unimpressive — that's normal, not a sign something's broken; it's the baseline the rest of the loop improves against.

## Step 3 — Choose a grading method

Anthropic's own advice on choosing: **pick the fastest, most reliable, most scalable method that's still capable of judging the thing you actually care about.**

### Code-based grading
Fastest and most reliable, extremely scalable, but has no nuance for judgment calls. Use it whenever the success criterion has an objectively checkable answer:
- **Exact match** — `output == golden_answer` (classification labels, fixed answers).
- **String match** — `key_phrase in output` (a required phrase, a forbidden phrase, a formatting marker).
- **Structural validation** — does it parse? (`json.loads()`, `ast.parse()`, `re.compile()` each wrapped to return a pass/fail score on success vs. a caught parse error). This is exactly how you'd check the "Specify the Desired Output Format" technique from prompt-engineering actually held.
- Similarity/overlap metrics for less rigid comparisons — cosine similarity between an output and a reference answer (consistency across paraphrases of the same question), ROUGE-L (summarization quality against a reference summary).

### Human grading
Most flexible, highest quality — and, per Anthropic's own advice, **the one to avoid if possible**, because it's slow and expensive and doesn't scale. Reach for it only when the judgment genuinely can't be automated yet (a brand-new, poorly-understood failure mode) and even then, treat it as a stepping stone toward a model-based grader you can validate against a handful of human judgments.

### LLM-based (model) grading
Fast, flexible, and scalable, and the right choice for judgment calls that resist a hard rule — tone, helpfulness, whether an answer is complete, whether a persona held. Three things make an LLM grader reliable rather than noisy:

1. **Have detailed, clear rubrics.** A vague grading prompt gets vague, inconsistent scores. Be as concrete as the sentiment-analysis example: *"The answer should always mention 'Acme Inc.' in the first sentence. If it does not, the answer is automatically graded as 'incorrect.'"* A single success criterion may need several rubrics to grade holistically — don't force everything into one instruction.
2. **Be empirical or specific.** Ask for a small, discrete output — `correct`/`incorrect`, or a 1-5 scale — rather than open-ended qualitative commentary. Purely qualitative grading is hard to assess quickly or at scale, and hard to aggregate into a single number you can compare across prompt versions.
3. **Encourage reasoning before scoring.** Ask the grader model to reason first (in `<thinking>` tags, say), then give the verdict (in `<result>` tags, or as a final field), and discard the reasoning from what you actually record. This is not optional polish — **without it, models tend to default to middling scores around 6**, because a bare "give it a score" question doesn't force the grader to actually examine the response. The stronger structure asks for the verdict *alongside* `strengths` (1-3), `weaknesses` (1-3), and `reasoning`, then extracts just the numeric `score` for aggregation.
4. **Use a different model to grade than the one that generated the output**, where practical — grading with the same model that produced the answer risks the grader rationalizing its own output rather than judging it independently.

Combining methods is normal and often best: e.g. average a code-based format-validity score with a model-based task-accuracy score for one overall figure per test case, rather than picking exactly one method for the whole eval.

## Step 4 — Run it and read the result

The mechanical shape of a working eval pipeline, regardless of what language you implement it in:

- **Run the prompt** — merge each test case's input into the prompt template and call Claude.
- **Grade the result** — apply the chosen grading method(s) from Step 3 to get a score per test case.
- **Aggregate** — collect model output, the original test case, and the score for every case; compute the average (and look at the distribution, not just the mean — a 7.5 average hiding a cluster of 2s is a different problem than a uniform 7.5).

A realistic pipeline over even a small dataset takes real wall-clock time (tens of seconds is normal, even on a fast model) — don't assume something's broken if it isn't instant, but do keep the dataset small while iterating quickly and only scale it up for a validation pass you actually intend to trust.

## Step 5 — Close the loop

The score is not the deliverable — the revised prompt is. When a category of test case scores poorly, that's a diagnosis pointing at a specific fix:

| Symptom in the eval | Likely fix (see prompt-engineering) |
|---|---|
| Output format drifts case to case | Increase Consistency: specify exact format, constrain with a full example, or prefill |
| Confident-sounding wrong answers | Reduce Hallucinations: allow "I don't know," ground in quotes, require citations |
| Fails on edge cases (sarcasm, ambiguity) not in the original examples | Add more/better multishot examples covering those cases specifically |
| Grader gives vague or middling scores across the board | The eval itself needs work, not the prompt — tighten the rubric, or add reasoning-before-score to the grader |
| Persona breaks under an unusual user message | Increase Consistency's "keep Claude in character": add that scenario to the system prompt's prepared-response list |

Make one change at a time and re-run the eval before making another — Anthropic's own advice is explicit here: **the key is to make one change at a time, evaluate the impact, and build on what works.** Changing three things and seeing the score go up tells you nothing about which change mattered; changing one thing at a time turns the eval into a genuine before/after comparison, which is the entire point of building it.

## Handing off

If the user came in with a prompt that needs restructuring — not just measuring — before it's worth evaluating (no clear technique applied, format not specified, no examples where the task clearly needs them), say so and point back to **prompt-engineering** first. Building a careful eval around a prompt that has an obvious, fixable structural problem is solving the wrong half of the loop.

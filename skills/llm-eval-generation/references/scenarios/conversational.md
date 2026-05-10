# Conversational Agent Eval Reference

Load this file when the code under test manages multi-turn conversations: `ChatHistory`,
`MessagesPlaceholder`, session or memory management, or any pattern that maintains state across
multiple dialogue turns.

Distinct from single-turn QA: conversational eval must assess the full session trajectory,
not just individual turns. A response that is correct in isolation may fail when the full
conversation context is considered.

---

## Failure Modes

- **Context loss across turns** — agent forgets information established earlier in the conversation
- **Topic drift** — agent loses track of the user's goal over multiple turns
- **Inconsistent persona** — agent contradicts its own prior statements about its identity or
  capabilities
- **Failure to escalate** — agent attempts to handle queries beyond its capability or scope
  instead of transferring to a human
- **Sycophancy** — agent agrees with the user even when the user is factually wrong, to avoid
  conflict
- **Excessive verbosity** — agent pads responses across turns, reducing usability
- **Premature resolution** — agent closes the conversation before the user's goal is fully met

---

## Required Metrics

| Metric | Definition | Requires ground truth? | Tool |
|---|---|---|---|
| **Conversation Coherence** | Agent is logically consistent across turns | No | LLM-as-judge (G-Eval) |
| **Topic Adherence** | Agent stays on task across the conversation | No | RAGAS, G-Eval |
| **Response Consistency** | Agent does not contradict its own prior turns | No | LLM-as-judge |
| **Helpfulness** | Agent actually helps the user accomplish their goal | No | LLM-as-judge with rubric |
| **Escalation Accuracy** | Agent escalates when appropriate; handles when capable | Yes (domain rules) | Custom |

> Conversational eval is evaluated at the **session level**, not the turn level. The unit of
> evaluation is the full conversation, not individual messages. Turn-level metrics miss failure
> modes that only emerge across multiple exchanges.

---

## Evaluation Strategy

### Always evaluate at session level

Collect the full conversation trace and evaluate it as a unit.

```python
def evaluate_session(conversation: list[dict]) -> dict:
    """
    conversation: [{"role": "user"|"assistant", "content": "..."}, ...]
    Returns metric scores for the full session.
    """
    full_transcript = format_transcript(conversation)
    return {
        "coherence": score_coherence(full_transcript),
        "topic_adherence": score_topic_adherence(full_transcript),
        "helpfulness": score_helpfulness(full_transcript),
    }
```

### LangSmith multi-turn evaluation

For LangChain/LangGraph systems, LangSmith evaluates complete agent conversations on semantic
intent and trajectory quality — not just the final turn.

### Collect user feedback signals

For production systems, integrate user feedback directly into eval datasets:
- Thumbs up/down per turn → flag negative-rated turns for investigation
- Conversation abandonment → sessions where users left without resolution are failure cases
- Escalation requests → user asking for a human agent signals chatbot failure

```python
# Langfuse browser SDK — collect real-time user feedback
langfuse.score(
    trace_id=session_trace_id,
    name="user-satisfaction",
    value=1,  # or 0 for negative
    comment="User clicked thumbs down on turn 3",
)
```

---

## G-Eval Session-Level Configuration

```python
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCaseParams

coherence_metric = GEval(
    name="Conversation Coherence",
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
    criteria="The agent's responses are logically consistent with each other and with the conversation history.",
    evaluation_steps=[
        "Read the full conversation transcript.",
        "Identify any statements made by the agent.",
        "Check whether any agent statement contradicts a prior agent statement.",
        "Check whether the agent correctly recalls facts established earlier in the conversation.",
        "Score 1–10: 10 = fully coherent, no contradictions, correct recall.",
    ],
    model="gpt-4o",
    threshold=0.8,
)

topic_adherence_metric = GEval(
    name="Topic Adherence",
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
    criteria="The agent stays focused on the user's goal throughout the conversation.",
    evaluation_steps=[
        "Identify the user's primary goal from the first few turns.",
        "Read the full conversation.",
        "Identify any agent responses that are off-topic or lose track of the user's goal.",
        "Score 1–10: 10 = fully on-topic throughout, 1 = loses track of goal frequently.",
    ],
    model="gpt-4o",
    threshold=0.7,
)

helpfulness_metric = GEval(
    name="Conversation Helpfulness",
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
    criteria="The agent successfully helps the user accomplish their stated goal by the end of the conversation.",
    evaluation_steps=[
        "Identify the user's goal.",
        "Determine whether the user's goal was fully achieved by the end of the conversation.",
        "If the goal was not achieved, determine whether the agent escalated appropriately.",
        "Penalise sycophancy — agent agreeing with the user when the user is wrong.",
        "Score 1–10: 10 = goal fully achieved or appropriately escalated.",
    ],
    model="gpt-4o",
    threshold=0.7,
)
```

---

## DeepEval Conversational Example

```python
# evals/eval_conversational.py
import pytest
from deepeval import assert_test
from deepeval.test_case import ConversationalTestCase, LLMTestCase, Message

CONVERSATION_SCENARIOS = [
    {
        "name": "return_policy_multi_turn",
        "turns": [
            {"user": "I'd like to return something.", "assistant": agent.chat},
            {"user": "I bought it 25 days ago.", "assistant": agent.chat},
            {"user": "I don't have the receipt.", "assistant": agent.chat},
        ],
        "goal": "User wants to return a purchase; agent should explain policy and options",
    },
]

@pytest.mark.parametrize("scenario", CONVERSATION_SCENARIOS)
def test_conversation_quality(scenario):
    messages = []
    for turn in scenario["turns"]:
        response = turn["assistant"](turn["user"], history=messages)
        messages.append(Message(role="user", content=turn["user"]))
        messages.append(Message(role="assistant", content=response))

    test_case = ConversationalTestCase(
        turns=[
            LLMTestCase(input=m.content, actual_output=messages[i+1].content)
            for i, m in enumerate(messages[::2])
        ]
    )
    assert_test(test_case, [
        coherence_metric,
        topic_adherence_metric,
        helpfulness_metric,
    ])
```

---

## Escalation Accuracy Eval

```python
ESCALATION_CASES = [
    {
        "trigger": "I want to speak to a human agent.",
        "should_escalate": True,
    },
    {
        "trigger": "I have a complex legal dispute about my account.",
        "should_escalate": True,
    },
    {
        "trigger": "What are your opening hours?",
        "should_escalate": False,
    },
]

@pytest.mark.parametrize("case", ESCALATION_CASES)
def test_escalation_accuracy(case):
    response, escalated = agent.chat_with_escalation_signal(case["trigger"])
    assert escalated == case["should_escalate"], \
        f"Escalation mismatch for: {case['trigger']!r}. " \
        f"Expected escalation={case['should_escalate']}, got {escalated}."
```

---

## Eval Dataset Requirements

Minimum 15 conversation scenarios. Each scenario must span ≥ 3 turns. Must include:
- Conversations that reach successful resolution (happy path)
- Conversations that require escalation — test that the agent escalates and does not attempt
  to handle beyond its capability
- Conversations where the user changes their mind mid-conversation
- Conversations where the user provides ambiguous or contradictory information
- Adversarial conversations where the user attempts to manipulate the agent across turns
- Edge cases: very short conversations, very long conversations (≥ 10 turns)

---

## CI Thresholds

| Metric | Minimum | Notes |
|---|---|---|
| Coherence (G-Eval) | 0.8 | Cross-turn consistency |
| Topic Adherence | 0.7 | Staying on user goal |
| Helpfulness (G-Eval) | 0.7 | Goal achievement or appropriate escalation |
| Escalation Accuracy | 1.0 | Escalation decisions are binary — no tolerance for wrong escalation |

---

## Recommended Stack

| Layer | Tool | Reason |
|---|---|---|
| Session-level eval | DeepEval ConversationalTestCase + G-Eval | pytest-native; session trajectory scoring |
| LangChain/LangGraph | LangSmith multi-turn evaluations | Zero-config integration; semantic intent scoring |
| User feedback | Langfuse browser SDK | Real user satisfaction signals from production |
| Human annotation | Review queue (Langfuse / Braintrust) | Edge cases and escalation calibration |

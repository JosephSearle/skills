# Structured Output Eval Reference

Load this file when the code under test produces structured output: Pydantic model as output
type, `.with_structured_output()`, `response_format=`, JSON schema in return type, or any
pattern where the LLM is expected to produce a specific schema-conformant structure.

---

## Failure Modes

- **Schema violation** — output does not conform to the expected JSON schema
- **Missing required fields** — required fields are absent or null when they should not be
- **Wrong field types** — a string where an integer is expected, an array instead of an object
- **Hallucinated values** — model invents field values not derivable from the input
- **Inconsistent format** — output structure varies across runs for identical inputs
- **Partial extraction** — model extracts some fields correctly but misses others

---

## Required Metrics

| Metric | Definition | Requires ground truth? | Deterministic? |
|---|---|---|---|
| **Schema Validity** | Output conforms to the defined JSON schema | No | Yes — use jsonschema/Pydantic |
| **Field Extraction Accuracy** | Extracted values match ground truth values | Yes | No — LLM-as-judge or exact match |
| **Extraction Faithfulness** | Extracted values are present in the input; none are invented | No | No — faithfulness metric |
| **Format Consistency** | Output format is stable across multiple runs | No | No — statistical |

---

## Evaluation Strategy

### Schema validation is always the first gate and requires no LLM

Run schema validation before any LLM-based metric. It is deterministic, free, and catches the
majority of structural failures immediately.

```python
import jsonschema
from pydantic import BaseModel, ValidationError

# Option A: Pydantic validation (preferred when output type is a Pydantic model)
def validate_pydantic(output_dict: dict, model: type[BaseModel]) -> bool:
    try:
        model(**output_dict)
        return True
    except ValidationError as e:
        print(e)
        return False

# Option B: jsonschema validation
def validate_schema(output: dict, schema: dict) -> bool:
    try:
        jsonschema.validate(output, schema)
        return True
    except jsonschema.ValidationError as e:
        print(e.message)
        return False
```

### Field accuracy requires a labelled extraction dataset

Build a golden dataset of input → expected output field values. This is the primary ongoing
investment for structured output evaluation — schema validation alone does not verify correctness.

### Measure format consistency

Run each input ≥ 3 times and check whether the output structure is stable. High variance in
structure (e.g. sometimes wrapping in a list, sometimes not) is a reliability failure.

```python
def format_consistency(extractor_fn, input_text: str, trials: int = 5) -> float:
    outputs = [extractor_fn(input_text) for _ in range(trials)]
    schemas = [set(o.keys()) for o in outputs]
    # Consistency = fraction of runs with the same key set as the first run
    return sum(1 for s in schemas if s == schemas[0]) / trials
```

---

## DeepEval Example

```python
# evals/eval_structured_output.py
import pytest
from deepeval import assert_test
from deepeval.metrics import FaithfulnessMetric, GEval
from deepeval.metrics.base_metric import BaseMetric
from deepeval.test_case import LLMTestCase
import jsonschema

OUTPUT_SCHEMA = {
    "type": "object",
    "required": ["company_name", "founded_year", "headquarters"],
    "properties": {
        "company_name": {"type": "string"},
        "founded_year": {"type": "integer"},
        "headquarters": {"type": "string"},
    },
}

class SchemaValidityMetric(BaseMetric):
    """Deterministic schema validation — no LLM call required."""
    def __init__(self, schema: dict):
        self.schema = schema
        self.threshold = 1.0
        self.name = "Schema Validity"

    def measure(self, test_case: LLMTestCase) -> float:
        import json
        try:
            output = json.loads(test_case.actual_output)
            jsonschema.validate(output, self.schema)
            self.success = True
            return 1.0
        except Exception as e:
            self.reason = str(e)
            self.success = False
            return 0.0

    async def a_measure(self, test_case):
        return self.measure(test_case)

    def is_successful(self):
        return self.success

field_accuracy = GEval(
    name="Field Extraction Accuracy",
    criteria="The extracted field values are accurate and match the information in the input text.",
    evaluation_steps=[
        "Identify each field in the extracted output.",
        "Verify that the value of each field is supported by the input text.",
        "Penalise any field whose value is invented or contradicts the input.",
    ],
    model="gpt-4o",
    threshold=0.8,
)

@pytest.mark.parametrize("input_text,expected_fields", [
    (
        "Anthropic was founded in 2021 and is headquartered in San Francisco.",
        {"company_name": "Anthropic", "founded_year": 2021, "headquarters": "San Francisco"},
    ),
])
def test_structured_extraction(input_text, expected_fields):
    actual_output = extractor.extract(input_text)
    test_case = LLMTestCase(
        input=input_text,
        actual_output=str(actual_output),
        context=[input_text],
    )
    assert_test(test_case, [
        SchemaValidityMetric(schema=OUTPUT_SCHEMA),
        FaithfulnessMetric(threshold=0.9, model="gpt-4o"),
        field_accuracy,
    ])
```

---

## Eval Dataset Requirements

Minimum 15 cases. Must include:
- Clear inputs where all required fields are present in the text (happy path)
- Inputs where some fields are absent — model should return null or a default, not invent values
- Inputs designed to trigger hallucination (adversarial — contain plausible-sounding wrong values)
- Inputs with ambiguous field values (edge cases)
- Inputs where the same field appears multiple times with different values (consistency test)

---

## CI Thresholds

| Metric | Minimum | Notes |
|---|---|---|
| Schema Validity | 1.0 | Binary gate — any schema failure blocks |
| Extraction Faithfulness | 0.9 | Higher than RAG because hallucination in extraction is directly user-visible |
| Field Accuracy (G-Eval) | 0.8 | |
| Format Consistency | 0.9 | Measured across ≥ 3 trials per input |

---

## Recommended Stack

| Layer | Tool | Reason |
|---|---|---|
| Schema validation | jsonschema / Pydantic (deterministic) | First gate; no LLM cost |
| CI gating | DeepEval (FaithfulnessMetric + GEval) | Field accuracy and hallucination detection |
| Production monitoring | Braintrust or Langfuse | Tracking extraction quality over time; regression alerting |

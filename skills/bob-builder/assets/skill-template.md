---
name: <skill-name>
description: >
  <One-sentence summary of what this skill does.>
  Triggers on: "<trigger phrase 1>", "<trigger phrase 2>", "<trigger phrase 3>".
---
<!-- NOTE: IBM Bob frontmatter recognises ONLY `name` and `description`.
     Do not add version, author, or any other fields — they are silently ignored. -->

<!-- NOTE: This skill activates only in IBM Bob's Advanced mode. -->

<Steps>
  <Step>
    ## Step 1 — Detect Context
    <What to observe or read before doing anything else.>
    <Use decision trees for conditional logic:>

    ```
    Signal A detected   → Load references/topic-a.md
    Signal B detected   → Load references/topic-b.md
    Neither detected    → Ask: "<clarifying question>"
    ```
  </Step>

  <Step>
    ## Step 2 — Load References
    <Which reference files to load based on Step 1 findings.>

    Always load: `references/<universal-file>.md`

    Conditionally:
    - If <condition A> → load `references/<file-a>.md`
    - If <condition B> → load `references/<file-b>.md`
  </Step>

  <Step>
    ## Step 3 — <Core Task Title>
    <Main instructions for the primary task.>

    <Use tables for structured requirements:>

    | Requirement | How to satisfy it |
    |---|---|
    | <Requirement 1> | <Approach 1> |
    | <Requirement 2> | <Approach 2> |

    <Use code blocks for examples:>
    ```<language>
    // canonical example
    ```
  </Step>

  <Step>
    ## Step 4 — Write Output to Disk
    Write the generated output to:
    - `<output-file-path>` — <description of what goes here>

    Confirm the file path to the developer after writing.

    <Optional: run guidance>
    To run / activate:
    ```bash
    <command to run or test the output>
    ```
  </Step>
</Steps>

<!--
DIRECTORY LAYOUT for this skill (create what's needed):

.bob/skills/<skill-name>/
  SKILL.md              ← this file
  references/           ← topic files Bob loads conditionally (optional)
    <topic>.md
  scripts/              ← shell scripts Bob executes during the skill (optional)
    <script>.sh
  assets/               ← templates Bob emits verbatim (optional)
    <template>.<ext>
-->

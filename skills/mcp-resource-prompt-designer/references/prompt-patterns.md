# Prompt Patterns Reference

## Prompts vs Tools

| | Prompt | Tool |
|-|--------|------|
| Who invokes it? | User (slash command in UI) | Model (autonomously during task) |
| Returns | Template messages for the conversation | Tool execution result |
| Arguments | Declared, shown in client UI | Input schema (Zod) |
| Security concern | Argument injection into messages | Input to shell/SQL/URLs |

**Critical distinction:** Never write a prompt the model would invoke autonomously — that's a tool. Prompts are user-initiated conversation starters.

---

## Argument Declaration

```ts
@Prompt({
  name: 'review_pr',
  description: 'Generate a code review for a pull request.',
  arguments: [
    {
      name:        'pr_url',
      description: 'URL of the pull request to review',
      required:    true,
    },
    {
      name:        'focus',
      description: 'Review focus area: security | performance | style | all',
      required:    false,
    },
  ],
})
async reviewPr({ pr_url, focus = 'all' }: { pr_url: string; focus?: string }) {
  ...
}
```

Client UIs use the argument declarations to render an input form for the slash command.

---

## Injection-Safe Message Construction

Argument values are untrusted text. If a value can close a delimiter, it can inject instructions.

**Unsafe — do not do this:**
```ts
// Value containing ``` closes the code fence and injects arbitrary instructions
text: `Review this code:\n\`\`\`\n${userCode}\n\`\`\``
// Attacker input: "code``` Ignore previous instructions..."
```

**Safe — use XML delimiters:**
```ts
// XML tags cannot be closed by content that doesn't contain the exact closing tag
text: `Review this ${language} code:\n<code>\n${sanitise(userCode)}\n</code>`
// Attacker input is contained: <code>... ```Ignore previous...</code>
```

**Safe — use distinct markers:**
```ts
const DELIMITER = `----BEGIN-CODE-${crypto.randomUUID()}----`;
text = `Review this code:\n${DELIMITER}\n${userCode}\n${DELIMITER}`;
```

---

## Return Format

Prompts return a message array — the client inserts these into the conversation:

```ts
return {
  description: 'Code review prompt for the specified PR',
  messages: [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Please review the pull request at ${sanitise(pr_url)} focusing on ${focus} issues.`,
      },
    },
  ],
};
```

The `description` field is shown in the client UI before the user submits.

---

## Multi-turn Prompts

Prompts can include multiple messages to establish context:

```ts
messages: [
  {
    role: 'user',
    content: { type: 'text', text: 'You are a security-focused code reviewer.' },
  },
  {
    role: 'assistant',
    content: { type: 'text', text: 'I am ready to review code for security vulnerabilities.' },
  },
  {
    role: 'user',
    content: { type: 'text', text: `Please review:\n<code>\n${code}\n</code>` },
  },
],
```

Keep the pre-populated messages minimal — they consume context window before the conversation starts.

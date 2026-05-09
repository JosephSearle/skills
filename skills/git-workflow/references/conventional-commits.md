# Conventional Commits Reference

Specification: https://www.conventionalcommits.org/en/v1.0.0/

---

## Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

---

## Type Reference

| Type | SemVer | Use when |
|------|--------|---------|
| `feat` | MINOR | Introducing new functionality visible to users or consumers |
| `fix` | PATCH | Correcting a bug |
| `docs` | — | Documentation changes only (README, inline docs, changelogs) |
| `style` | — | Formatting, whitespace, semicolons — zero logic change |
| `refactor` | — | Code restructure that neither adds a feature nor fixes a bug |
| `perf` | — | Change that improves performance |
| `test` | — | Adding, updating, or fixing tests |
| `build` | — | Build tooling, dependency updates, package manager config |
| `ci` | — | CI/CD pipeline configuration (GitHub Actions, Dockerfiles) |
| `chore` | — | Maintenance tasks that don't fit any other type |
| `revert` | — | Reverting a previous commit — reference the reverted SHA in the body |

---

## Breaking Changes

Two equivalent notations:

**Option 1 — `!` suffix (preferred for brevity):**
```
feat!: drop support for Node 18
fix(api)!: change authentication header format
```

**Option 2 — `BREAKING CHANGE` footer:**
```
feat(api): change response envelope structure

BREAKING CHANGE: the `data` key is now `result` in all API responses.
Consumers must update all response destructuring.
```

Both options can be combined. When `!` is used, the footer may be omitted if the description is self-explanatory.

---

## Scope

Optional. A lowercase noun describing the section of the codebase affected. Should be consistent across the repo.

Common scopes:
- `auth`, `api`, `ui`, `db`, `config`, `deps`, `ci`, `docs`

Examples:
```
feat(auth): add OAuth2 login
fix(api): handle null response on empty query
chore(deps): bump express to 4.19.0
```

---

## Description Rules

- Imperative mood: "add", "fix", "remove" — not "added", "fixes", "removing"
- Lowercase first letter
- No period at the end
- Max ~72 characters including type and scope

| Good | Bad |
|------|-----|
| `feat(auth): add OAuth2 login flow` | `feat(auth): Added OAuth2 Login Flow.` |
| `fix(api): handle null on empty list` | `fix: fixed the bug` |
| `chore: bump node to 20` | `chore: Updated Node version to 20.` |

---

## Body

Explain **why** the change was made, not what. Reference constraints, prior bugs, or decisions.

```
refactor(auth): replace session cookies with JWTs

Session cookies required sticky sessions on the load balancer.
JWTs allow stateless auth across all instances, which is required
for the Kubernetes migration planned for Q3.
```

- Separate from subject with a blank line
- Wrap at 72 characters per line
- May contain multiple paragraphs

---

## Footers

Appear after the body, separated by a blank line. Format: `Token: value` or `Token #value`.

Common footers:

```
Closes #42
Refs #17
Co-authored-by: Jane Smith <jane@example.com>
BREAKING CHANGE: <description>
Reviewed-by: Joe Bloggs <joe@example.com>
```

`BREAKING CHANGE` is case-sensitive. `BREAKING-CHANGE` is a valid synonym.

---

## Full Examples

**Simple feature:**
```
feat(auth): add OAuth2 login flow
```

**Bug fix with issue reference:**
```
fix(api): handle null response on empty query

The API was throwing a 500 when the database returned an empty
result set. Added a null check before destructuring the response.

Closes #83
```

**Breaking change with `!`:**
```
feat(api)!: remove deprecated v1 endpoints

All /v1/* routes have been removed. Consumers must migrate to /v2/*.
See migration guide in docs/v2-migration.md.

BREAKING CHANGE: /v1/users, /v1/auth, and /v1/posts are removed.
```

**Revert:**
```
revert: feat(auth): add OAuth2 login flow

Reverts commit abc1234 due to regression in session handling
discovered in staging. Will re-land after fix in #91.
```

**Multi-footer:**
```
feat(billing): add Stripe subscription management

Implements monthly and annual subscription tiers with proration
support for mid-cycle plan changes.

Closes #120
Co-authored-by: Jane Smith <jane@example.com>
Reviewed-by: Joe Bloggs <joe@example.com>
```

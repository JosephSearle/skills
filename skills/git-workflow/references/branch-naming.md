# Branch Naming Reference

---

## Format

```
<prefix>/<ticket-id>-<short-description>
```

Ticket ID is optional when there is no issue tracker or the change has no associated ticket.

```
<prefix>/<short-description>
```

---

## Prefix Glossary

| Prefix | Use when | Example |
|--------|---------|---------|
| `feature/` | Adding new functionality | `feature/AUTH-42-oauth2-login` |
| `fix/` | Fixing a bug | `fix/API-17-null-on-empty-list` |
| `hotfix/` | Urgent fix directly against production | `hotfix/PROD-9-payment-timeout` |
| `release/` | Preparing a versioned release (Git Flow) | `release/2.4.0` |
| `chore/` | Maintenance: deps, config, tooling | `chore/bump-node-20` |
| `docs/` | Documentation changes only | `docs/update-api-reference` |
| `ci/` | CI/CD pipeline changes | `ci/add-integration-test-stage` |
| `refactor/` | Code restructuring with no behaviour change | `refactor/AUTH-55-extract-token-service` |
| `perf/` | Performance improvements | `perf/reduce-db-query-count` |
| `test/` | Test additions or fixes only | `test/add-auth-integration-tests` |

---

## Rules

- **Always lowercase** — no uppercase letters anywhere
- **Kebab-case only** — words separated by `-`, not `_` or spaces
- **Prefix with `/` separator** — `feature/`, not `feature-`
- **Max 50 characters** after the prefix slash
- **No special characters** except `-` and `/`
- **Ticket ID before description** — `feature/AUTH-42-oauth2-login`, not `feature/oauth2-login-AUTH-42`
- **Short, specific descriptions** — "oauth2-login" not "new-login-stuff"

---

## Worked Examples

| Scenario | Branch name |
|---------|------------|
| New user authentication feature, ticket AUTH-42 | `feature/AUTH-42-oauth2-login` |
| Fixing a null pointer in the API, ticket API-17 | `fix/API-17-null-on-empty-list` |
| Urgent production payment bug, ticket PROD-9 | `hotfix/PROD-9-payment-timeout` |
| Preparing the 2.4.0 release | `release/2.4.0` |
| Bumping Node.js to version 20, no ticket | `chore/bump-node-20` |
| Updating the API reference docs, no ticket | `docs/update-api-reference` |
| Adding integration test stage to CI pipeline | `ci/add-integration-test-stage` |
| Extracting token logic into its own service | `refactor/AUTH-55-extract-token-service` |

---

## Common Mistakes

| Wrong | Right | Why |
|-------|-------|-----|
| `Feature/AUTH-42-OAuth2-Login` | `feature/AUTH-42-oauth2-login` | Must be lowercase |
| `feature_AUTH_42_oauth2_login` | `feature/AUTH-42-oauth2-login` | Use `/` prefix separator and `-` within |
| `feature/auth` | `feature/AUTH-42-oauth2-login` | Too vague — include ticket and description |
| `AUTH-42-oauth2-login` | `feature/AUTH-42-oauth2-login` | Missing prefix |
| `fix/fixed the null pointer bug in the api response handler` | `fix/API-17-null-on-empty-list` | Too long, has spaces |

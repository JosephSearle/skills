# Jira Ticket Templates

> These templates are the output layer for the Jira ticket creation skill. Each template defines the exact fields to populate, their format, required vs. optional status, and guidance notes for the AI agent. The research document (`jira-research.md`) is the reasoning layer — consult it for classification logic and quality rules.

---

## How to use these templates

Each template has three sections:

- **Fields** — every field the ticket should contain, with format and whether it is required or optional
- **Agent guidance** — rules the AI must apply when populating this template
- **Example** — a fully populated, realistic example the agent can use as a quality benchmark

---

## 1. Story (User Story)

**Purpose:** Delivers a small, user-facing piece of value completable within one sprint.

### Fields

| Field | Format | Required |
|---|---|---|
| **Title** | Short capability phrase (no "As a…" in title) | ✅ |
| **User Story Statement** | `As a [persona], I want to [action] so that [benefit]` | ✅ |
| **Background / Context** | 1–3 sentences: why this matters, what problem it solves | ✅ |
| **Acceptance Criteria** | Gherkin: `Given [context] / When [action] / Then [outcome]` — minimum 1, maximum 3 | ✅ |
| **Out of Scope** | Bullet list of explicitly excluded behaviour | Optional |
| **Dependencies** | Links to blocking issues or prerequisite stories | Optional |
| **Story Points** | Fibonacci: 1, 2, 3, 5, 8 (13+ = split the story) | ✅ |
| **Parent Epic** | Epic link | ✅ |
| **Component** | Team/system component e.g. `Checkout`, `Auth`, `API` | ✅ |
| **Labels** | Freetext tags e.g. `frontend`, `backend`, `mobile` | Optional |

### Agent guidance

- The user story statement must be in user-voice form. Never write it in technical or system terms ("The system shall…" is wrong).
- Each acceptance criterion must be independently testable. If it cannot be answered pass/fail, rewrite it.
- If the user provides 4 or more acceptance criteria, suggest splitting the story before proceeding.
- Run the INVEST check before finalising: Independent, Negotiable, Valuable, Estimable, Small, Testable. Flag any criterion that fails.
- A story estimate of 13+ points is a strong signal to split. Flag this to the user.
- The title should reflect the user outcome, not the technical implementation. "Persist session token in Redis" is a task title, not a story title.
- If no persona is provided, ask the user who the user is before drafting. Do not default to "user."

### Example

**Title:** One-click reorder from order history

**User Story Statement:**
As a returning customer, I want to reorder a previous purchase in a single click so that I can repeat my usual orders without re-entering my basket manually.

**Background / Context:**
Customers frequently repeat the same orders. Currently they must browse the catalogue and add items individually. This story delivers the "Reorder" button on the Order History page, pre-populating the basket with all items from a selected past order.

**Acceptance Criteria:**
```
Given I am on the Order History page and have at least one past order
When I click "Reorder" on any order
Then all items from that order are added to my current basket and I am navigated to the basket page

Given one or more items from the original order are now out of stock
When I click "Reorder"
Then available items are added to the basket and an inline notification lists the unavailable items by name

Given I already have items in my basket
When I click "Reorder"
Then the existing basket items are preserved and the reorder items are appended
```

**Out of Scope:** Price changes are not surfaced at this step (handled by basket review). Subscription items are excluded from reorder.

**Story Points:** 3
**Parent Epic:** `EPIC-42` – Returning Customer Experience
**Component:** Checkout
**Labels:** `frontend`, `basket`

---

## 2. Bug

**Purpose:** Records a defect where the product does not behave as intended or specified.

### Fields

| Field | Format | Required |
|---|---|---|
| **Title** | `[Feature] – [failure behaviour] when [condition]` | ✅ |
| **Summary** | 1–2 sentence plain-English description of the defect | ✅ |
| **Environment** | OS, browser/app version, device, test/staging/prod | ✅ |
| **Steps to Reproduce** | Numbered list — atomic steps from a clean state | ✅ |
| **Expected Result** | What should happen | ✅ |
| **Actual Result** | What actually happens | ✅ |
| **Reproduction Rate** | e.g. `5/5`, `3/5 (intermittent)` | ✅ |
| **Severity** | `Critical / High / Medium / Low` (technical impact) | ✅ |
| **Priority** | `Highest / High / Medium / Low` (business urgency) | ✅ |
| **Affects Version/s** | The version/release where the defect was found | ✅ |
| **Attachments** | Screenshot, screen recording, console log, network trace | Optional (strongly encouraged) |
| **Parent Epic / Feature** | Link to the epic or feature this defect belongs to | Optional |
| **Component** | System component where the bug occurs | ✅ |
| **Labels** | e.g. `regression`, `data-loss`, `accessibility`, `performance` | Optional |

### Agent guidance

- Severity and priority are independent axes. Severity = how badly the system is broken. Priority = how urgently the business needs it fixed. Always populate both separately.
  - Critical severity: system unusable, data loss, security breach, no workaround.
  - High severity: major feature broken, workaround exists but painful.
  - Medium severity: feature degraded but usable.
  - Low severity: cosmetic, minor inconvenience.
- Steps to reproduce must start from a clean, documented state (e.g. "logged in as a standard user on Chrome 124, staging environment"). Never assume context.
- Expected result must reference the specification or designed behaviour — not just "it should work." If the spec is ambiguous, note this.
- Actual result must be factual and specific. Never speculate about cause ("probably caused by the last deploy" is not allowed in the actual result field).
- If the user cannot reproduce the bug consistently, note the reproduction rate and any patterns (specific user, time of day, data state).
- A bug where the feature actually works as specified but could be better should be reclassified as an Improvement. Flag this to the user.

### Example

**Title:** CHECKOUT – payment form submits twice when "Pay Now" double-clicked (Chrome 124)

**Summary:**
Rapidly double-clicking the "Pay Now" button on the checkout payment step submits the payment form twice, resulting in duplicate charges appearing in the payment provider dashboard. The user sees a success message for both transactions.

**Environment:**
- OS: macOS 14.4
- Browser: Chrome 124.0.6367.91
- Environment: Production
- Account type: Standard customer

**Steps to Reproduce:**
1. Add any item to basket and proceed to checkout
2. Complete delivery address and select a shipping method
3. Enter valid test card details on the payment step
4. Double-click the "Pay Now" button rapidly (within ~300ms)

**Expected Result:**
The button is disabled after the first click. Only one payment transaction is submitted. The user sees a single order confirmation.

**Actual Result:**
Two separate payment transactions are created in the payment provider dashboard. The user sees two order confirmation emails. The button remains active between the two clicks.

**Reproduction Rate:** 4/5

**Severity:** Critical
**Priority:** Highest

**Affects Version/s:** v4.2.1
**Component:** Checkout / Payments
**Labels:** `regression`, `data-integrity`

---

## 3. Epic

**Purpose:** A large body of work spanning multiple sprints that delivers a meaningful product outcome. Decomposes into stories, tasks, and bugs.

### Fields

| Field | Format | Required |
|---|---|---|
| **Title** | `[Epic] <outcome/capability name>` | ✅ |
| **Goal / Outcome** | 1–2 sentences: the measurable outcome this epic achieves (not a feature description) | ✅ |
| **Business Value / Why** | Why this epic is being done — link to OKR, strategic theme, or business problem | ✅ |
| **Benefit Hypothesis** | `We believe [this epic] will result in [outcome] for [user/business]. We will know this is true when [measurable leading indicator].` | ✅ |
| **Scope — In** | Bullet list of what this epic includes | ✅ |
| **Scope — Out** | Bullet list of what this epic explicitly does NOT include | ✅ |
| **Acceptance Criteria / Definition of Done** | High-level conditions that must be true for this epic to be considered complete | ✅ |
| **Child Stories / Features** | Links to decomposed stories and features | Optional at creation |
| **Dependencies** | Upstream/downstream epics or external dependencies | Optional |
| **Owner** | Product Owner or accountable person | ✅ |
| **Target Quarter / PI** | The planned delivery horizon | ✅ |
| **Parent Initiative** | Link to parent initiative if applicable | Optional |
| **Labels** | e.g. `Q3-2025`, `customer-facing`, `platform` | Optional |

### Agent guidance

- The Goal/Outcome must be an outcome, not a feature. "Launch new checkout page" is a feature. "Reduce basket abandonment at payment step by 15%" is an outcome.
- If the user describes a goal in feature terms, reframe it as a measurable outcome and confirm with the user before proceeding.
- The benefit hypothesis follows the Lean Startup assumption-testing pattern. It must be falsifiable — "we will know this is true when X" must be measurable.
- Scope In/Out prevents scope creep and misalignment. Always populate both, even if Out of Scope only says "see linked epics for X."
- An epic with no decomposed stories yet is acceptable at creation — but flag to the user that decomposition should happen before the epic enters sprint planning.
- If the described work could fit in a single sprint, suggest reclassifying as a Story. If it spans more than a quarter or requires multiple teams, suggest escalating to an Initiative.

### Example

**Title:** [Epic] Returning Customer Experience — One-Click Reorder

**Goal / Outcome:**
Enable returning customers to repeat past purchases without re-entering order details, reducing repeat-order time to under 30 seconds.

**Business Value / Why:**
35% of our orders are from customers reordering the same items. Currently the repeat-order journey requires 7+ steps. This epic targets basket abandonment from repeat customers, which accounts for 18% of abandoned sessions. Linked to OKR: "Increase repeat purchase rate by 20% in Q3."

**Benefit Hypothesis:**
We believe enabling one-click reorder will result in a 20% increase in repeat purchase rate for registered customers. We will know this is true when the 30-day repeat purchase rate for customers who have used the reorder feature reaches 40% (up from 33% baseline).

**Scope — In:**
- Reorder button on Order History page
- Pre-population of basket with all in-stock items from a selected order
- Inline notification for out-of-stock items
- Reorder from email order confirmation (phase 2, same epic)

**Scope — Out:**
- Subscription/recurring orders (separate epic)
- Guest customer reorder (requires account creation — separate initiative)
- Price change alerts between original and reorder (separate story)

**Acceptance Criteria / Definition of Done:**
- Reorder feature is available to 100% of registered users
- Basket pre-population works for orders up to 50 line items
- Out-of-stock handling is implemented and tested
- Feature is instrumented with analytics events
- Accessibility audit passed (WCAG 2.1 AA)
- Load tested at peak traffic volumes

**Owner:** Jane Smith (Product Owner, Commerce)
**Target Quarter:** Q3 2025
**Parent Initiative:** INIT-7 – Registered Customer Retention

---

## 4. Task

**Purpose:** A specific, bounded piece of technical or operational work with no direct user-facing value. Typically supports delivery of a story, epic, or operational need.

### Fields

| Field | Format | Required |
|---|---|---|
| **Title** | Verb-first imperative phrase e.g. "Configure staging environment for payment service" | ✅ |
| **Description** | What needs to be done and why — enough detail for someone unfamiliar to pick it up | ✅ |
| **Acceptance Criteria / Done When** | Bullet list of specific, verifiable conditions that mark this task complete | ✅ |
| **Approach / Notes** | Technical approach, relevant links, decisions already made | Optional |
| **Dependencies** | Blocking tasks, stories, or external requirements | Optional |
| **Estimate** | Story points or time estimate | ✅ |
| **Parent Story / Epic** | Link to the parent story or epic this task supports | Optional |
| **Assignee** | Named person or team | Optional |
| **Component** | System/service component | ✅ |
| **Labels** | e.g. `devops`, `documentation`, `security`, `tech-debt` | Optional |

### Agent guidance

- The title must start with a verb. "CI pipeline for staging" is incomplete; "Configure CI pipeline for staging environment" is correct.
- A task that delivers direct user-visible value should be reclassified as a Story. A task is purely implementation/operational.
- "Done When" criteria must be specific and verifiable, not vague. "It works" is not acceptable. "Pipeline runs green on merge to `main` and deploys to staging within 10 minutes" is correct.
- If a task estimate is more than 2 days and has multiple independent parts, recommend breaking into sub-tasks.
- Tech debt tasks should be labelled `tech-debt` and include the impact of not doing the work (e.g. "Without this upgrade, we cannot use Spring Boot 3.x features and remain on an unsupported version").

### Example

**Title:** Configure GitHub Actions CI pipeline for payment-service staging deployment

**Description:**
The payment-service currently has no automated CI pipeline. Engineers deploy manually to staging using a local script, which has caused three deployment failures this quarter due to environment inconsistencies. This task sets up a GitHub Actions workflow that runs tests, builds the Docker image, and deploys to the staging environment on every merge to `main`.

**Acceptance Criteria / Done When:**
- GitHub Actions workflow file is committed to `payment-service` repo
- Pipeline triggers automatically on merge to `main`
- All existing unit tests run as part of the pipeline
- Docker image builds successfully and is pushed to the container registry
- Deployment to staging completes without manual intervention
- Pipeline status is visible on the repo's README badge
- Failure notifications are sent to the `#engineering-alerts` Slack channel

**Approach / Notes:**
- Use the existing `deploy.sh` script as the basis for the deploy step
- Staging environment credentials are stored in GitHub Secrets (ask DevOps for access)
- Reference the `frontend-service` workflow as a pattern: `.github/workflows/deploy-staging.yml`

**Estimate:** 3 points
**Parent Story:** N/A (operational improvement)
**Component:** DevOps / Infrastructure
**Labels:** `devops`, `ci-cd`

---

## 5. Feature

**Purpose:** A SAFe-aligned, user-facing product capability deliverable by one team or ART within a PI (approximately one quarter). Sits between Epic and Story in the hierarchy. Delivers measurable business value and decomposes into stories.

### Fields

| Field | Format | Required |
|---|---|---|
| **Title** | Short phrase naming the user-facing capability e.g. "Loyalty rewards integration in mobile app" | ✅ |
| **Feature Statement (FAB)** | `Feature: [capability name]. Benefit Hypothesis: [who benefits + measurable outcome]. For: [user segment].` | ✅ |
| **Description** | 2–4 sentences expanding on the feature, the problem it solves, and who it serves | ✅ |
| **Acceptance Criteria** | High-level conditions validating the benefit hypothesis; include at least one NFR | ✅ |
| **Non-Functional Requirements (NFRs)** | Performance, security, accessibility, scalability constraints | ✅ |
| **Child Stories** | Links to decomposed user stories | Optional at creation |
| **Dependencies** | Upstream features, infrastructure, third-party integrations | Optional |
| **WSJF Inputs** | Business Value, Time Criticality, Risk Reduction / Opportunity Enablement (for prioritisation) | Optional |
| **Owner** | Product Manager or Feature Owner | ✅ |
| **Target PI / Sprint** | Planned delivery horizon | ✅ |
| **Parent Epic** | Link to parent epic | ✅ |
| **Component** | Product area e.g. `Mobile App`, `Platform`, `API` | ✅ |

### Agent guidance

- The Feature Statement follows the FAB (Feature and Benefit) format from SAFe. The benefit must be measurable — if the user only describes the feature, ask "what is the intended outcome for the business or user?" before drafting.
- Do not use the "As a… I want… so that…" user-story voice for features — features serve multiple user roles and a story-voice statement is too narrow.
- NFRs are mandatory. Common NFRs to prompt: "What are the performance requirements?", "Are there accessibility standards to meet?", "What are the security/compliance constraints?"
- A feature sized beyond one PI or requiring multiple ARTs should be escalated to an Epic or Capability. Flag this if scope seems too large.
- Acceptance criteria for a feature are higher-level than story AC — they validate the benefit hypothesis, not individual interactions.

### Example

**Title:** Loyalty Rewards Integration — Mobile App

**Feature Statement (FAB):**
Feature: Enable customers to view and redeem loyalty points directly within the mobile app.
Benefit Hypothesis: We believe this feature will increase mobile app monthly active users by 15% and reduce loyalty programme churn by 10% within one quarter of release.
For: Registered customers enrolled in the loyalty programme.

**Description:**
Currently, customers must visit the web portal to check and redeem loyalty points. This creates friction and reduces engagement with the loyalty programme on mobile. This feature brings the full loyalty rewards experience — balance visibility, point history, and redemption at checkout — into the mobile app, eliminating the need to switch to the web portal.

**Acceptance Criteria:**
- Loyalty points balance is displayed on the account home screen for all enrolled customers
- Points history (last 12 months) is accessible and loads within 2 seconds
- Points can be applied at mobile checkout with a single tap
- Feature is accessible at WCAG 2.1 AA standard
- Integration with the Loyalty API handles failures gracefully (degraded state, no crash)
- Analytics events are instrumented for balance view, history view, and redemption

**Non-Functional Requirements:**
- Loyalty balance API response time ≤ 500ms at p95
- Secure token-based authentication to Loyalty API (OAuth 2.0)
- Works on iOS 16+ and Android 12+
- Data cached locally for offline balance display (max 24hr staleness)

**Owner:** Sarah Ahmed (Product Manager, Mobile)
**Target PI:** PI-6 (Q3 2025)
**Parent Epic:** `EPIC-31` – Mobile App Loyalty Programme
**Component:** Mobile App / Loyalty

---

## 6. Test Case

**Purpose:** A structured, repeatable QA test that verifies a specific behaviour works as specified. Traced to a user story or acceptance criterion.

### Fields

| Field | Format | Required |
|---|---|---|
| **Title** | `[Feature/Component]: [scenario being tested]` | ✅ |
| **Test Case ID** | `[COMPONENT]_TC_[NNN]` e.g. `LOGIN_TC_001` | ✅ |
| **Objective** | One sentence: what this test case verifies | ✅ |
| **Preconditions** | Bullet list of system state and data required before the test runs | ✅ |
| **Test Data** | Specific data values to use e.g. username, email, amounts | ✅ |
| **Test Steps** | Numbered atomic actions (one action per step) | ✅ |
| **Expected Result** | The specific observable outcome after all steps are completed | ✅ |
| **Postconditions** | System state after test completion (if relevant) | Optional |
| **Test Type** | `Functional / Regression / Exploratory / Performance / Accessibility` | ✅ |
| **Priority** | `High / Medium / Low` | ✅ |
| **Linked Story / AC** | Link to the parent story or acceptance criterion being tested | ✅ |
| **Component** | Feature area under test | ✅ |
| **Status** | `Draft / Ready / Pass / Fail / Blocked` | ✅ |

### Agent guidance

- Every test case must trace to a requirement, acceptance criterion, or story. Never create a test case without a linked story or AC.
- Test steps must be atomic — one action per step. "Log in and navigate to checkout" is two steps.
- Expected result must be specific and observable: a visible UI state, a message, a redirect, a data change. "It works" or "succeeds" is not acceptable.
- Preconditions must be fully stated so any tester — including someone new to the team — can run the test without asking questions.
- Test Data must use realistic but non-production values. Never include real customer data.
- Each test case should cover one scenario. If a test case covers multiple independent scenarios, split it.
- Common test types to suggest: happy path (primary scenario), unhappy path (error/edge case), boundary value (min/max inputs), regression (confirming existing behaviour after a change).

### Example

**Title:** Login: valid credentials redirect authenticated user to dashboard

**Test Case ID:** LOGIN_TC_001

**Objective:**
Verify that a registered user with valid credentials is successfully authenticated and redirected to their account dashboard.

**Preconditions:**
- Test user account exists: `testuser@example.com` / `P@ssword123!`
- Account is active (not suspended or locked)
- User is logged out (no active session)
- Browser: Chrome 124, staging environment

**Test Data:**
- Email: `testuser@example.com`
- Password: `P@ssword123!`

**Test Steps:**
1. Navigate to `https://staging.example.com/login`
2. Enter `testuser@example.com` in the Email field
3. Enter `P@ssword123!` in the Password field
4. Click the "Sign In" button

**Expected Result:**
- User is redirected to `/dashboard`
- Page title reads "Welcome back, Test User"
- Navigation bar displays the user's first name "Test"
- No error messages are displayed

**Postconditions:**
- User session is active
- Session cookie is set with correct expiry

**Test Type:** Functional
**Priority:** High
**Linked Story:** `STORY-204` – Registered user login with email and password
**Component:** Auth / Login
**Status:** Ready

---

## 7. Improvement

**Purpose:** An incremental enhancement to existing, working functionality. The feature already exists and functions correctly; this ticket makes it measurably better.

### Fields

| Field | Format | Required |
|---|---|---|
| **Title** | Imperative improvement phrase e.g. "Reduce checkout page load time from 4s to under 1s" | ✅ |
| **Current Behaviour** | Specific description of how the feature works today | ✅ |
| **Desired Behaviour** | Specific description of how it should work after the improvement | ✅ |
| **Value / Rationale** | Why this improvement matters — user impact, business metric, or technical benefit | ✅ |
| **Acceptance Criteria** | Measurable, testable conditions confirming the improvement is achieved | ✅ |
| **Approach / Options** | Known approaches or constraints (optional; do not prescribe solution if not known) | Optional |
| **Baseline Metric** | Current measurable state e.g. "average load time: 4.2s (Datadog, May 2025)" | Optional (strongly encouraged) |
| **Target Metric** | The measurable target e.g. "load time < 1s at p95" | Optional (strongly encouraged) |
| **Dependencies** | Related stories, infrastructure requirements | Optional |
| **Story Points** | Fibonacci estimate | ✅ |
| **Parent Epic** | Link to parent epic | Optional |
| **Component** | Affected system/feature component | ✅ |
| **Labels** | e.g. `performance`, `ux`, `accessibility`, `tech-debt` | Optional |

### Agent guidance

- The key distinguishing question is: "Does the feature currently work as specified?" If yes → Improvement. If no → Bug. If it doesn't exist yet → Story or Feature.
- Current Behaviour must describe what exists today, not what is wrong. Frame it factually, not as a complaint.
- Acceptance criteria must be measurable. "Faster" or "better UX" are not acceptable. "Page load time < 1s at p95 measured in Datadog" is correct.
- Baseline and Target Metric fields are strongly encouraged. Improvements without metrics often get deprioritised and are hard to validate.
- If the improvement is purely cosmetic with no user or business impact, prompt the user to articulate the value before proceeding.
- An improvement that requires building something that does not exist should be reclassified as a Story or Feature.

### Example

**Title:** Reduce product search results page load time from ~4s to under 1s

**Current Behaviour:**
The product search results page currently takes an average of 4.2 seconds to load from search submission to full page render (measured in Datadog APM, May 2025, p95). All search requests trigger a synchronous call to the product catalogue API, which performs no result caching. This has been linked to a 12% drop-off rate on the search results page in analytics.

**Desired Behaviour:**
Search results load in under 1 second at p95. Repeated searches for the same query within a 5-minute window are served from cache rather than re-querying the catalogue API.

**Value / Rationale:**
Page speed is directly correlated with conversion rate. A 3-second improvement in search load time is expected to reduce search drop-off from 12% to under 5% based on industry benchmarks, contributing to the Q3 OKR "Increase search-to-basket conversion by 10%."

**Acceptance Criteria:**
```
Given a user submits a search query
When the search results page loads
Then the time to interactive is under 1 second at p95 (measured in Datadog)

Given a user submits the same search query within 5 minutes of a previous identical search
When the results are returned
Then the response is served from cache and the API is not called

Given the cache is unavailable
When a user submits a search
Then the search falls back to a direct API call with no degradation in results accuracy
```

**Baseline Metric:** 4.2s average load time, p95 (Datadog APM, May 2025)
**Target Metric:** < 1s at p95

**Story Points:** 5
**Parent Epic:** `EPIC-18` – Platform Performance
**Component:** Search / Catalogue API
**Labels:** `performance`, `caching`

---

## Agent Classification Reference

Use this quick-reference to determine the correct issue type before applying a template.

| Signal | Suggested Type |
|---|---|
| New user-facing value, one sprint | **Story** |
| New user-facing capability, one PI/quarter | **Feature** |
| Large body of work, multiple sprints, outcome-driven | **Epic** |
| Existing feature works but could be measurably better | **Improvement** |
| Feature is broken / does not behave as specified | **Bug** |
| Technical/operational work with no direct user value | **Task** |
| Verifying a specific behaviour in QA | **Test Case** |

### When to prompt the user for reclassification

- User describes a Bug but the feature works as specified → reclassify as Improvement
- User describes a Story with 4+ acceptance criteria → suggest splitting or escalating to Feature/Epic
- User describes a Feature spanning more than one quarter → suggest escalating to Epic
- User describes a Task that delivers user-visible value → reclassify as Story
- User describes an Epic completable in one sprint → suggest reclassifying as Story or Feature
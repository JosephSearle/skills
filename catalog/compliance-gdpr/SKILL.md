---
name: compliance-gdpr
description: >
  UK/EU GDPR compliance policy skill, covering the seven Article 5 data
  protection principles, lawful basis for processing (including the
  DUAA 2025's recognised legitimate interests basis), data subject
  rights, and accountability mechanisms (ROPA, DPIA, DPO). Use whenever
  a project collects, stores, uses, or shares personal data about an
  identifiable individual — designing a new data flow, a user-facing
  feature, an API that returns personal data, or drafting a spec.md
  involving personal data, or whenever the user asks for a GDPR/data
  protection review, even unnamed. Applies based on whose data is
  processed (UK/EU individuals), not where the project is hosted or the
  company is based. Assumes security-baseline is already loaded — this
  skill covers legal/regulatory obligations around personal data, not
  security controls, though the two overlap (e.g. both care about data
  minimisation and secure storage).
summary: UK/EU GDPR compliance policy covering the seven Article 5 data protection principles, lawful basis for processing (including the DUAA 2025's recognised legitimate interests basis), data subject rights, and accountability mechanisms (ROPA, DPIA, DPO); walks a project's actual data flows against each section and flags gaps as named areas of concern rather than assuming compliance -- applies based on whose data is processed, not where the project is hosted, and assumes security-baseline is already loaded for the security-control side of data handling.
---

# UK/EU GDPR Compliance

This skill covers what's specific to processing personal data under
UK GDPR (and, by extension, EU GDPR, which shares the same core
structure). It does not repeat security-baseline's secrets/infra
guidance — GDPR is a legal/regulatory framework about *why and how* data
may be processed at all, not a security control list, though satisfying
GDPR often requires the security controls baseline already covers (e.g.
"integrity and confidentiality" below overlaps directly with baseline).

Before applying this, ask what personal data the project actually
touches (names, emails, behavioural data, special category data such as
health or biometric data), whose data it is (UK/EU individuals trigger
this regardless of where the project is hosted), and whether the
project is a data controller, processor, or both for that data — don't
assume.

## 1. The seven core principles (Article 5)
Every processing activity must be defensible against all seven — these
are not aspirational guidelines, they're the enforceable core of the
regime:
- **Lawfulness, fairness and transparency** — processing must have a
  lawful basis (section 2) and be conducted in a way the data subject
  would reasonably expect, disclosed to them in plain language.
- **Purpose limitation** — data collected for one specified, explicit,
  legitimate purpose must not be further processed in a manner
  incompatible with that purpose. A new use requires reassessing
  compatibility, not just proceeding.
- **Data minimisation** — collect and retain only what's adequate,
  relevant, and limited to what's necessary for the stated purpose. Flag
  any field or dataset gathered "in case it's useful later."
- **Accuracy** — personal data must be accurate and kept up to date;
  inaccurate data must be corrected or erased.
- **Storage limitation** — data must not be kept longer than necessary
  for the purpose it was collected for. Flag any system with no defined
  retention period or deletion mechanism.
- **Integrity and confidentiality** — data must be processed securely,
  protected against unauthorised or unlawful processing and against
  accidental loss, destruction, or damage. This is the principle that
  directly overlaps with security-baseline — satisfying baseline's
  secrets/infra/data-handling sections is part of satisfying this one.
- **Accountability** — the controller must be able to *demonstrate*
  compliance with the other six, not just achieve it. This is the
  principle most often missed by teams that process data correctly in
  practice but keep no evidence of having done so.

## 2. Lawful basis for processing
Every single processing activity needs its own identified lawful basis
— there is no blanket justification ("we're a legitimate business" is
not itself a lawful basis). As of the Data (Use and Access) Act 2025
(in force from February 2026), UK GDPR recognises seven:
consent, contract, legal obligation, vital interests, public task,
legitimate interests, and the newly added **recognised legitimate
interests** (a narrower, pre-defined basis covering specific purposes
such as safeguarding, crime prevention, and emergencies, which doesn't
require the usual balancing test).
- Ask which basis applies to each distinct processing activity in the
  project, and confirm it's documented — don't let a project ship with
  an assumed-but-unstated basis.
- Consent, when used, must be a genuine, specific, informed, unambiguous
  opt-in — not a pre-checked box or bundled into general terms.

## 3. Data subject rights
Individuals have rights that often carry direct engineering
implications, not just legal/policy ones:
- **Right to erasure** ("right to be forgotten") — the system must have
  an actual technical mechanism to locate and delete a specific
  individual's data on request, not just a written policy describing
  the right.
- **Right of access** — a mechanism to retrieve and provide everything
  held about a specific individual, within statutory timeframes (the
  DUAA's "stop the clock" provision allows pausing the one-month
  response window while awaiting identity verification or clarification
  from the requester).
- **Right to rectification, restriction, portability, and objection** —
  each may require its own technical capability depending on how the
  system stores and uses the data; don't assume a generic "we can edit
  records" capability satisfies all of these.
- **Rights around automated decision-making** — if a system makes a
  significant decision about someone based solely on automated
  processing (credit scoring, automated rejection of an application),
  additional rights and safeguards apply — flag this explicitly, since
  it also intersects directly with the EU AI Act's high-risk tier
  (compliance-eu-ai-act).

## 4. Accountability mechanisms
The mechanisms that turn "we're compliant" from a claim into something
auditable:
- **Record of Processing Activities (ROPA)** — a maintained record of
  what personal data is processed, why, under which lawful basis, and
  for how long. Flag any project handling personal data with no ROPA
  entry.
- **Data Protection Impact Assessment (DPIA)** — required for
  high-risk processing (large-scale special category data, systematic
  monitoring, automated decision-making with legal/significant effects).
  Ask whether the project's processing meets this bar before assuming
  a DPIA isn't needed.
- **Data Protection Officer (DPO)** — required for certain
  organisations/processing types; not universal, but worth confirming
  whether the org this project sits in has one and whether this
  project's processing should route through them.

## How to apply this skill
1. Ask what personal data is involved, whose data it is, and the
   project's role (controller/processor).
2. Walk sections 1–4 against the project's actual data flows and
   design.
3. Flag violations as explicit "areas of concern," naming which
   section they violate. Where a concern overlaps with
   security-baseline (e.g. storage security, retention), name both the
   legal obligation and the security control it maps to.
4. For any automated decision-making with significant effects on
   individuals, cross-reference compliance-eu-ai-act — the same system
   is very likely to also carry AI Act obligations.

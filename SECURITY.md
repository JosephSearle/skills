# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities privately using
[GitHub's private vulnerability reporting](https://github.com/JosephSearle/skills/security/advisories/new):
go to the **Security** tab of this repository and select **Report a vulnerability**. This opens a
private draft advisory visible only to you and the maintainer — it isn't a public issue.

Please don't report security issues through public GitHub issues, discussions, or pull requests.

## What to include

To help us understand and reproduce the issue, please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce it
- The affected file(s) or part of the repo (e.g. a specific skill under `catalog/`, or the
  `site/` app)
- Any known mitigation or workaround, if you have one

## Response

This is a small, actively maintained project with no fixed response-time guarantee. We take
security reports seriously and will do our best to acknowledge and address them promptly, but
please don't expect a specific SLA.

## Disclosure

Please give us a reasonable amount of time to investigate and address a report before disclosing
it publicly.

## Scope

This repository has no dependency or maintenance-branch structure that would make a
supported-versions table meaningful — the `main` branch is the only supported version. `site/`
does depend on third-party npm packages; vulnerabilities in those packages themselves should be
reported to their own maintainers, not here.

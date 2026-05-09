# Security Code Review Reference

Primary authority: [OWASP Top 10:2021](https://owasp.org/Top10/2021/) | [OWASP Code Review Guide](https://owasp.org/www-project-code-review-guide/)
Supporting references: NIST SSDF (SP 800-218) | SANS Secure Coding Standards

Load this reference on every PR regardless of language. Work through each category in order.
Language-specific injection and cryptography patterns are in the language reference files — use both.

---

## A01:2021 — Broken Access Control

The most critical OWASP category. Occurs when users can act outside their intended permissions.

### Missing server-side authorisation check
- **Look for:** Endpoints or functions that read, modify, or delete data using a user-supplied ID (account number, record ID, file path) without verifying the requesting user owns or has permission to access that resource
- **Why:** Attackers modify parameters to access arbitrary records. Client-side controls (hidden fields, URL parameters, cookies) are trivially bypassed. All access decisions must be enforced server-side
- **Suggest:** After fetching the resource, assert ownership: `if record.owner_id != current_user.id: raise Forbidden()`. Never rely on the client to send only IDs they own
- **Severity:** blocker

### Deny-by-default not applied
- **Look for:** New endpoints or routes with no explicit authorisation decorator, middleware, or guard — particularly POST, PUT, DELETE, and PATCH methods
- **Why:** OWASP guidance: access control must "deny by default" for non-public resources. An unguarded endpoint is accessible to anyone who discovers it
- **Suggest:** Every non-public route must have an explicit auth check. Use a framework-level guard applied globally, with explicit opt-out for public routes — not opt-in per route
- **Severity:** blocker

### JWT not short-lived or not validated server-side
- **Look for:** JWTs with no expiry (`exp` claim missing), very long-lived tokens (days/weeks), or signature verification skipped/commented out
- **Why:** OWASP: "Keep JWT tokens short-lived." A stolen token without expiry grants permanent access. Skipping signature verification allows forged tokens
- **Suggest:** Set `exp` to minutes/hours, not days. Always verify signature and `exp` on every request. Implement a token revocation mechanism for logout
- **Severity:** blocker

### CORS policy too permissive
- **Look for:** `Access-Control-Allow-Origin: *` on authenticated endpoints, or CORS origins dynamically reflected from the `Origin` request header without validation
- **Why:** An overly permissive CORS policy allows any website to make credentialed cross-origin requests to your API on behalf of a logged-in user
- **Suggest:** Restrict `Access-Control-Allow-Origin` to an explicit allowlist of known origins. Never reflect the request `Origin` header without validating it
- **Severity:** major

---

## A02:2021 — Cryptographic Failures

Covers failures to protect sensitive data through inadequate or absent encryption.

### Sensitive data transmitted over HTTP
- **Look for:** HTTP (non-TLS) URLs in API clients, fetch calls, or HTTP client configuration; missing HSTS headers; redirect from HTTP to HTTPS rather than enforcing HTTPS from the start
- **Why:** Data in transit over plain HTTP is readable by any network observer. OWASP: enforce TLS with forward secrecy ciphers; use HSTS to prevent downgrade attacks
- **Suggest:** Enforce HTTPS at the load balancer or application layer. Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` header. Reject HTTP connections rather than redirecting
- **Severity:** blocker

### Weak or broken hashing algorithm
- **Look for:** `MD5`, `SHA1`, `SHA-1`, `DES`, `RC4`, or `ECB` in any cryptographic context — hashing passwords, signing data, generating tokens, or encrypting content
- **Why:** MD5 and SHA-1 are cryptographically broken. ECB mode leaks patterns in encrypted data. These algorithms provide no real security guarantee
- **Suggest:** Use SHA-256 or SHA-3 for general hashing. For passwords specifically, use Argon2, bcrypt, or scrypt. For encryption, use AES-GCM or ChaCha20-Poly1305 (authenticated encryption)
- **Severity:** blocker

### Password stored without a proper adaptive hash
- **Look for:** Passwords hashed with MD5, SHA-1, SHA-256, or any non-adaptive function; passwords stored with a static salt or no salt; plain text password storage
- **Why:** Fast hashes (MD5, SHA-256) allow billions of guesses per second. OWASP requires "strong adaptive and salted hashing functions" — Argon2, scrypt, bcrypt, or PBKDF2 with a high work factor
- **Suggest:** Use Argon2id (preferred), bcrypt (cost ≥12), or scrypt. Never implement your own password hashing
- **Severity:** blocker

### Hardcoded secret or key
- **Look for:** API keys, passwords, encryption keys, tokens, or connection strings as string literals in source code — including in test files and config files committed to the repo
- **Why:** Code is version controlled and often shared or leaked. Hardcoded secrets persist in git history even after removal. This is the most common cause of credential exposure
- **Suggest:** Load secrets from environment variables or a secrets manager (AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager). Add the file to `.gitignore` if it must exist locally. Rotate any secret that was committed immediately
- **Severity:** blocker

### Missing encryption for sensitive data at rest
- **Look for:** PII, payment data, health records, or credentials stored in a database column, file, or cache with no encryption; encryption keys stored in the same location as encrypted data
- **Why:** If the storage layer is compromised, unencrypted sensitive data is immediately readable. Regulations (GDPR, PCI-DSS, HIPAA) mandate encryption at rest for specific data categories
- **Suggest:** Encrypt sensitive fields at the application layer using authenticated encryption (AES-GCM). Store encryption keys separately, managed via a KMS
- **Severity:** major

---

## A03:2021 — Injection

Occurs when user-supplied data is interpreted as code or commands by an interpreter.

### SQL injection via string concatenation
- **Look for:** `"SELECT * FROM users WHERE id = '" + userId + "'"` or any string concatenation building a SQL query with a variable that originates from user input
- **Why:** An attacker can terminate the query and inject arbitrary SQL, enabling data extraction, modification, or deletion. One of the most exploited vulnerabilities in history
- **Suggest:** Use parameterised queries or prepared statements exclusively: `db.query("SELECT * FROM users WHERE id = $1", [userId])`. Use an ORM where possible, but verify it uses parameterisation internally
- **Severity:** blocker

### OS command injection
- **Look for:** `exec()`, `shell_exec()`, `subprocess.run(shell=True, ...)`, `os.system()`, or `child_process.exec()` called with any string that includes user input, even partially
- **Why:** An attacker who controls any part of a shell command can escape it and run arbitrary commands on the host. `shell=True` in Python is almost always wrong when user input is involved
- **Suggest:** Use parameterised forms: `subprocess.run(["cmd", arg1, arg2])` (list form, no shell). Never pass user input into a shell string. Validate and allowlist inputs strictly if a command must include user data
- **Severity:** blocker

### NoSQL injection
- **Look for:** MongoDB queries built by merging user-supplied objects directly: `db.find({ username: req.body.username })` where `req.body.username` could be `{ "$gt": "" }`
- **Why:** NoSQL databases support query operators in JSON. Unsanitised user input can inject operators that bypass authentication or return all records
- **Suggest:** Validate and sanitise all query parameters. Use schema validation to reject unexpected object types. Ensure user-supplied values are cast to expected primitives before use in queries
- **Severity:** blocker

### LDAP injection
- **Look for:** LDAP filters constructed with user input via string concatenation: `"(&(uid=" + username + ")(password=" + password + "))"`
- **Why:** LDAP special characters (`*`, `(`, `)`, `\`, `NUL`) alter filter logic, allowing attackers to bypass authentication or extract directory data
- **Suggest:** Use a library that supports parameterised LDAP queries. Escape all user input using the appropriate LDAP escaping function before interpolation
- **Severity:** blocker

---

## A04:2021 — Insecure Design

Architectural and design-level flaws that no amount of correct implementation can fully fix.

### No rate limiting on sensitive operations
- **Look for:** Login endpoints, password reset flows, OTP verification, payment processing, or expensive API calls with no rate limiting middleware or account lockout logic
- **Why:** Without rate limiting, attackers can brute-force credentials, exhaust OTP codes, or run up costs via automated requests. OWASP: "Apply resource consumption limits per user or service"
- **Suggest:** Apply rate limiting at the API gateway or middleware level. Implement exponential backoff and temporary lockout after N failed attempts. Use CAPTCHA for high-value flows
- **Severity:** major

### Security enforced client-side only
- **Look for:** Validation logic, access checks, or business rules implemented in JavaScript/frontend code with no corresponding server-side enforcement
- **Why:** Client-side controls are trivially bypassed — any user can modify their browser environment or send raw HTTP requests. OWASP: "Implement access controls server-side only — never trust client data"
- **Suggest:** Every security-relevant check (auth, validation, business rule) must exist server-side. Frontend validation is a UX feature only
- **Severity:** blocker

### Insecure credential recovery flow
- **Look for:** Password reset via security questions ("knowledge-based answers"), reset links that do not expire, reset tokens sent via insecure channels, or reset flows that enumerate valid accounts
- **Why:** Security questions are easily researched or guessed. Non-expiring reset links allow indefinite account takeover if intercepted
- **Suggest:** Send time-limited (15–60 min), single-use reset tokens to the registered email. Use consistent messaging to prevent account enumeration ("If that email exists, you'll receive a reset link")
- **Severity:** major

---

## A05:2021 — Security Misconfiguration

Improper security hardening in code, configuration, or infrastructure.

### Stack trace or internal error detail exposed to client
- **Look for:** Error handlers that return raw exception messages, stack traces, SQL error strings, or internal file paths to API responses or HTTP responses
- **Why:** Stack traces expose internal architecture, file paths, and library versions that help attackers craft targeted attacks. OWASP: "Error handling reveals stack traces or other overly informative error messages to users"
- **Suggest:** Return a generic error message to clients: `{"error": "An unexpected error occurred"}`. Log the full detail server-side with a correlation ID the client can reference
- **Severity:** major

### Debug mode enabled in production configuration
- **Look for:** `DEBUG=true`, `debug: true`, `APP_ENV=development` in production config files or environment variable defaults; framework debug modes left on (Django `DEBUG=True`, Express detailed errors)
- **Why:** Debug mode exposes detailed error pages, enables development-only endpoints, disables caching, and often weakens security controls
- **Suggest:** All production deployments must explicitly set `DEBUG=false` or equivalent. Use environment-specific config with no defaults that could accidentally enable debug mode in production
- **Severity:** blocker

### Sensitive cookie missing security flags
- **Look for:** Session cookies, auth tokens, or CSRF tokens set without `HttpOnly`, `Secure`, and `SameSite` attributes
- **Why:** Missing `HttpOnly` allows JavaScript to read the cookie (XSS vector). Missing `Secure` allows transmission over HTTP. Missing `SameSite` enables CSRF attacks
- **Suggest:** `Set-Cookie: session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/`
- **Severity:** major

### Missing security headers
- **Look for:** HTTP responses lacking `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy` headers on HTML-serving endpoints
- **Why:** Security headers are the primary defence against XSS, clickjacking, MIME-sniffing, and referrer leakage. Their absence leaves standard browser-level protections disabled
- **Suggest:** Apply headers via middleware on all responses. At minimum: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive `Content-Security-Policy`
- **Severity:** major

---

## A06:2021 — Vulnerable and Outdated Components

Risks from dependencies with known security flaws.

### New dependency added without version pinning
- **Look for:** Newly added entries in `package.json`, `go.mod`, `requirements.txt`, or similar that use a floating version range (`^1.0`, `>=2`, `*`) rather than an exact or tightly bounded version
- **Why:** Floating versions allow a compromised or maliciously updated version of a package to be silently pulled in on the next install. OWASP: source components from official channels with version integrity
- **Suggest:** Pin to an exact version for security-sensitive dependencies. Use lock files (`package-lock.json`, `poetry.lock`, `go.sum`) and commit them. Run `npm audit` / `pip-audit` / `govulncheck` as part of CI
- **Severity:** major

### Known-vulnerable dependency introduced
- **Look for:** Any newly added or upgraded dependency that appears in CVE/NVD databases or returns a finding from `npm audit`, `pip-audit`, `govulncheck`, or Snyk
- **Why:** Importing a component with a known CVE directly introduces that vulnerability to the application. OWASP: "Continuously inventory component versions" and monitor CVE/NVD
- **Suggest:** Do not merge until the dependency is updated to a patched version. If no patch exists, evaluate a replacement library or implement a mitigation
- **Severity:** blocker (for critical/high CVE) / major (for medium)

---

## A07:2021 — Identification and Authentication Failures

Weaknesses in user identity, authentication, and session management.

### Password stored in plain text or with a fast hash
- **Look for:** `sha256(password)`, `md5(password)`, `hashlib.sha256(password)`, or any fast hashing applied to passwords before storage
- **Why:** Fast hashes allow attackers to brute-force billions of passwords per second after a database breach. OWASP requires adaptive hashing specifically for passwords
- **Suggest:** Use Argon2id, bcrypt (cost ≥12), scrypt, or PBKDF2. Use a well-maintained library — never implement password hashing manually
- **Severity:** blocker

### Session ID exposed in URL
- **Look for:** Session tokens, auth tokens, or API keys passed as URL query parameters: `?session=abc123`, `?token=xyz`
- **Why:** URLs are logged by servers, proxies, and browsers. Session IDs in URLs appear in Referrer headers, browser history, and access logs — massively expanding the exposure surface
- **Suggest:** Transmit session tokens exclusively via cookies (with `HttpOnly; Secure`) or `Authorization` headers. Never in the URL
- **Severity:** blocker

### Session not invalidated on logout
- **Look for:** Logout handlers that clear a client-side cookie or token without also invalidating the session server-side; JWT-only auth with no revocation mechanism
- **Why:** If the session remains valid server-side after logout, a stolen token continues to work. True logout requires server-side invalidation
- **Suggest:** On logout, delete or invalidate the session record server-side. For JWTs, maintain a short-lived token blocklist or switch to opaque session tokens
- **Severity:** major

### No MFA on privileged or sensitive operations
- **Look for:** Admin endpoints, large financial transactions, account settings changes, or privilege escalation flows that require only a password
- **Why:** Passwords alone are insufficient against credential stuffing, phishing, and credential reuse attacks. OWASP: implement MFA to prevent automated credential attacks
- **Suggest:** Require TOTP, hardware key, or push notification MFA for all admin access and high-value operations
- **Severity:** major

---

## A08:2021 — Software and Data Integrity Failures

Failures to protect against integrity violations in code, data, and pipelines.

### Deserialisation of untrusted data
- **Look for:** `pickle.loads()`, `yaml.load()` (without `Loader=yaml.SafeLoader`), `ObjectInputStream`, `JSON.parse()` on data from untrusted external sources without schema validation
- **Why:** Deserialising attacker-controlled data can trigger arbitrary code execution in many formats (Java serialisation, Python pickle). OWASP: "Objects encoded into structures attackers can modify" are a critical risk
- **Suggest:** Never deserialise untrusted data with unsafe deserialises. Use `yaml.safe_load()`, avoid `pickle` for untrusted input, use JSON with strict schema validation. Prefer data formats with no code execution capability
- **Severity:** blocker

### Dependency pulled from an untrusted or unverified source
- **Look for:** Dependencies imported from a personal GitHub repo, a CDN without SRI (Subresource Integrity) hashes, or a registry that is not the official package index for the language
- **Why:** Supply chain attacks inject malicious code into widely-used packages. OWASP: "Source components exclusively from official, secure channels with signed packages"
- **Suggest:** Use only the official registry for each language. For CDN-hosted scripts, add `integrity="sha384-..."` SRI attributes. Consider an internal vetted registry for high-security environments
- **Severity:** major

---

## A09:2021 — Security Logging and Monitoring Failures

Absence of adequate logging that would enable detecting and responding to breaches.

### Security-relevant event not logged
- **Look for:** Authentication attempts (success and failure), access control decisions, privilege escalation, and high-value transactions (payments, data exports) with no log statement
- **Why:** OWASP: "Auditable events, such as logins, failed logins, and high-value transactions, are not logged." Without this, breaches go undetected and forensic investigation is impossible
- **Suggest:** Log every auth attempt with timestamp, user identifier, source IP, and outcome. Log every access control failure. Ensure logs are written to a centralised, append-only store
- **Severity:** major

### Sensitive data written to logs
- **Look for:** Passwords, tokens, API keys, credit card numbers, SSNs, or PII appearing in `log.info(...)`, `console.log(...)`, `print(...)`, or similar log statements
- **Why:** Logs are often stored unencrypted, retained for long periods, and accessible to many people. Sensitive data in logs dramatically expands the blast radius of a log system compromise
- **Suggest:** Never log raw credentials or tokens. Truncate or mask sensitive fields: `log.info("payment processed", { card_last4: card[-4:] })`. Implement a log sanitisation layer for structured logging
- **Severity:** blocker

### User-controlled input written to logs without sanitisation
- **Look for:** `logger.info(f"User {username} logged in")` or similar where `username` originates from user input and is written directly to the log without escaping
- **Why:** Log injection: an attacker who controls a logged value can inject fake log entries, obscure a real attack, or exploit log parsers. OWASP: "Log data is not correctly encoded"
- **Suggest:** Sanitise or escape newlines and control characters from user-supplied values before logging: `username.replace('\n', '\\n')`
- **Severity:** major

---

## A10:2021 — Server-Side Request Forgery (SSRF)

Occurs when an application fetches a remote resource using a user-supplied URL without validation.

### User-supplied URL fetched without validation
- **Look for:** `requests.get(user_url)`, `fetch(req.body.url)`, `http.Get(r.FormValue("url"))`, or any HTTP client call where the URL includes user-controlled input
- **Why:** An attacker can supply internal URLs (`http://localhost/admin`, `http://169.254.169.254/` cloud metadata) to exfiltrate internal data, scan internal networks, or bypass firewalls. OWASP: "SSRF flaws occur whenever a web application fetches a remote resource without validating the user-supplied URL"
- **Suggest:** Validate URLs against a strict allowlist of permitted schemas, domains, and ports. Reject any URL resolving to a private IP range (10.x, 172.16–31.x, 192.168.x, 127.x, 169.254.x). Never follow redirects blindly
- **Severity:** blocker

### Cloud metadata endpoint accessible
- **Look for:** No IP allowlisting or SSRF protection in code that makes outbound HTTP requests, deployed in a cloud environment (AWS, GCP, Azure) where `169.254.169.254` or `fd00:ec2::254` would return IAM credentials
- **Why:** The instance metadata endpoint returns cloud credentials that can be used to take over the cloud account. SSRF to this endpoint is one of the highest-impact attack chains in cloud environments
- **Suggest:** Block all requests to `169.254.169.254` and `fd00:ec2::254` at the network layer. Use IMDSv2 (AWS) which requires a session token. Restrict outbound HTTP from application hosts via firewall rules
- **Severity:** blocker

---

## Additional Industry-Standard Checks

These complement the OWASP Top 10 and are expected in enterprise security reviews.

### Secrets committed to the repository
- **Look for:** Any string that matches the pattern of an API key, token, private key, password, or connection string in source files, config files, test fixtures, or CI configuration. Also check git history for secrets that were added and then removed
- **Why:** Once committed, a secret is in the git history permanently and may have been cloned, forked, or cached. Rotation is the only remedy — but only if detected. Tools like GitGuardian, truffleHog, and GitHub Secret Scanning automate this check
- **Suggest:** Immediately rotate any committed secret. Add the file to `.gitignore`. Load secrets from environment variables or a secrets manager. Add a pre-commit hook (e.g. `detect-secrets`) to prevent future occurrences
- **Severity:** blocker

### Secrets managed via config file instead of a vault
- **Look for:** Secrets referenced from `.env` files, `config.yaml`, `appsettings.json`, or similar files that are committed or could be committed, rather than from a secrets manager
- **Why:** Config files are frequently copied, backed up, or accidentally committed. A secrets manager provides access control, audit logging, rotation, and ensures secrets never touch the filesystem
- **Suggest:** Reference secrets via a vault: AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager, or Azure Key Vault. Load them at runtime via the SDK, not from files
- **Severity:** major

### IAM role or permission is overly permissive
- **Look for:** IAM policies with `"Action": "*"`, `"Resource": "*"`, wildcard S3 bucket policies, or service accounts granted admin roles where a scoped role would suffice
- **Why:** Principle of least privilege: each service and role should have only the permissions required to perform its function. Overly permissive roles maximise the blast radius of a compromise
- **Suggest:** Scope IAM policies to the minimum required actions and specific resource ARNs. Use separate roles per service. Request a security review for any policy with wildcard actions or resources
- **Severity:** major

### PII or sensitive data logged or returned in API responses unnecessarily
- **Look for:** Full credit card numbers, SSNs, passwords, raw health data, or unnecessary PII fields returned in API responses or written to logs
- **Why:** Data minimisation is a core principle of GDPR, HIPAA, and PCI-DSS. Exposing data beyond what is necessary increases regulatory risk and breach impact
- **Suggest:** Return only the fields the client needs. Mask sensitive values: `card_last4` not `card_number`. Never log full PII — use pseudonymised identifiers in logs
- **Severity:** major

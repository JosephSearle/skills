# Trivy/Grype CI Gate Reference

## Why a Vulnerability Gate

Base images accumulate CVEs over time. Without a CI gate, a known HIGH/CRITICAL vulnerability can be silently shipped. The gate fails the build on any unfixed HIGH or CRITICAL CVE, forcing a base image update or an explicit exception.

## Trivy (GitHub Actions)

```yaml
# .github/workflows/docker.yml
- name: Build image
  run: docker build -t $IMAGE .

- name: Scan for vulnerabilities
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.IMAGE }}
    format: table
    exit-code: '1'           # fail the build
    severity: HIGH,CRITICAL
    ignore-unfixed: true     # skip CVEs with no fix available (unavoidable)
    vuln-type: os,library
```

`ignore-unfixed: true` prevents blocking on CVEs that have no upstream fix — those are accepted risk.

## Grype (Alternative)

```yaml
- name: Scan with Grype
  uses: anchore/scan-action@v3
  with:
    image: ${{ env.IMAGE }}
    fail-build: true
    severity-cutoff: high
```

## .trivyignore

For accepted exceptions (e.g., CVEs with no fix or known-non-exploitable):

```
# Format: CVE-ID  (one per line)
# Add justification comments above each entry

# Justification: CVE in libcrypto only affects TLS 1.0 downgrade; we enforce TLS 1.3
CVE-2023-XXXXX

# Justification: CVE in libc only affects 32-bit builds; container runs 64-bit
CVE-2024-XXXXX
```

Review `.trivyignore` entries quarterly and remove when the fix is available.

## Scan Frequency

| When | What to scan |
|------|-------------|
| Every CI build | The freshly built image |
| Weekly scheduled job | Production images currently running (even if not rebuilt) |
| Before any promotion | Dev → staging → prod promotions |

Weekly scanning catches new CVEs in unchanged images — a CVE can be published after the image is built.

## Fixing CVE Findings

1. Update the base image tag in the Dockerfile.
2. Run `docker pull <base>` to get the latest and rebuild.
3. If the CVE is in a library dependency: `npm update <package>`.
4. If unfixed and unavoidable: add to `.trivyignore` with justification.

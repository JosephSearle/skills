# Go Test Generation Reference

Style authorities (official):
- [go.dev/wiki/TestComments](https://go.dev/wiki/TestComments) — Go's official test-specific style guide
- [go.dev/wiki/CodeReviewComments](https://go.dev/wiki/CodeReviewComments) — broader Go code review standards
- [pkg.go.dev/testing](https://pkg.go.dev/testing) — official testing package documentation
- [Uber Go Style Guide](https://github.com/uber-go/guide/blob/master/style.md) — widely adopted; supplements naming conventions

---

## File & Naming Conventions

| Element | Convention |
|---|---|
| Test files | `<file>_test.go` — same directory as the source file |
| Package (white-box) | Same package as source — can access unexported identifiers |
| Package (black-box) | `<pkg>_test` suffix — tests only the exported API |
| Test functions | `func TestXxx(t *testing.T)` — Xxx must start with an uppercase letter |
| Subtests | `t.Run("descriptor", func(t *testing.T) { ... })` |
| Benchmarks | `func BenchmarkXxx(b *testing.B)` |
| Fuzz functions | `func FuzzXxx(f *testing.F)` (Go 1.18+) |
| Examples | `func ExampleXxx()` — compiled and verified against `// Output:` comments |

**Naming convention for test functions (Uber supplement):**
Use `TestFuncName_WhenCondition` for the outer function. The `t.Run` descriptor describes the
specific case in plain English.

```go
// Outer function names the function under test + high-level condition group
func TestDivide_WhenDivisorIsZero(t *testing.T) { ... }

// Or with table-driven (preferred — see below):
func TestDivide(t *testing.T) {
    t.Run("when divisor is zero", func(t *testing.T) { ... })
    t.Run("when both inputs are positive", func(t *testing.T) { ... })
}
```

---

## Table-Driven Tests (The Canonical Go Pattern)

Table-driven tests are not just a best practice — they are the pattern used by Go's own standard
library and explicitly recommended by the Go team. Always use this pattern when a function has
multiple input/output variants.

```go
func TestAdd(t *testing.T) {
    tests := []struct {
        name string
        a, b int
        want int
    }{
        {name: "both positive", a: 2, b: 3, want: 5},
        {name: "positive and negative", a: 5, b: -3, want: 2},
        {name: "both zero", a: 0, b: 0, want: 0},
        {name: "large numbers", a: 1_000_000, b: 2_000_000, want: 3_000_000},
    }

    for _, tc := range tests {
        t.Run(tc.name, func(t *testing.T) {
            got := Add(tc.a, tc.b)
            if got != tc.want {
                t.Errorf("Add(%d, %d) = %d, want %d", tc.a, tc.b, got, tc.want)
            }
        })
    }
}
```

For functions returning `(T, error)`, always test both the value and the error:

```go
func TestParseConfig(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        want    *Config
        wantErr bool
    }{
        {name: "valid JSON", input: `{"port": 8080}`, want: &Config{Port: 8080}, wantErr: false},
        {name: "empty input", input: "", want: nil, wantErr: true},
        {name: "malformed JSON", input: `{bad}`, want: nil, wantErr: true},
    }

    for _, tc := range tests {
        t.Run(tc.name, func(t *testing.T) {
            got, err := ParseConfig(tc.input)
            if (err != nil) != tc.wantErr {
                t.Fatalf("ParseConfig(%q) error = %v, wantErr %v", tc.input, err, tc.wantErr)
            }
            if !tc.wantErr {
                if diff := cmp.Diff(tc.want, got); diff != "" {
                    t.Errorf("ParseConfig(%q) mismatch (-want +got):\n%s", tc.input, diff)
                }
            }
        })
    }
}
```

---

## No Assert Libraries (Official Go Team Position)

The official `go.dev/wiki/TestComments` explicitly states: **"Avoid the use of 'assert' libraries."**

Rationale from the Go team: assert libraries either stop test execution early (losing failure
information from later assertions) or force the use of a sub-language that is harder to read and
debug than plain Go.

**Do this:**
```go
if got != want {
    t.Errorf("MyFunc(%v) = %v, want %v", input, got, want)
}
```

**Not this:**
```go
assert.Equal(t, want, got)  // avoid
require.Equal(t, want, got) // avoid
```

### Exception: `google/go-cmp` for struct comparison

`google/go-cmp` (maintained by the Go team) is the **recommended** replacement for
`reflect.DeepEqual` and for testify struct assertions. It produces readable diffs and handles
unexported fields, cyclic structures, and custom comparison options.

```go
import "github.com/google/go-cmp/cmp"

if diff := cmp.Diff(want, got); diff != "" {
    t.Errorf("MyFunc() mismatch (-want +got):\n%s", diff)
}
```

The `(-want +got)` convention is the standard diff format. Always put `want` first in
`cmp.Diff(want, got)`.

---

## `t.Fatal` vs `t.Error`

Choosing incorrectly between these is one of the most common Go test mistakes.

| Function | Behaviour | Use when |
|---|---|---|
| `t.Error` / `t.Errorf` | Marks test failed, continues execution | Later assertions still provide useful independent information |
| `t.Fatal` / `t.Fatalf` | Marks test failed, stops this goroutine immediately | A failure makes subsequent steps invalid or would cause a panic |

```go
got, err := ParseConfig(input)
if err != nil {
    t.Fatalf("ParseConfig(%q) unexpected error: %v", input, err)
    // Fatal here: if err != nil, got is nil — accessing got.Port below would panic
}
if got.Port != wantPort {
    t.Errorf("ParseConfig(%q).Port = %d, want %d", input, got.Port, wantPort)
    // Error here: this assertion is independent — more failures are still useful
}
```

---

## Test Output Format (Official Convention)

From `go.dev/wiki/TestComments`: the standard failure message format is:

```
FuncName(input) = actual, want expected
```

**Actual comes first, expected second.** This is a hard convention from the Go team. Putting
expected first is considered incorrect by Go standards.

```go
// Correct — actual first, expected second
t.Errorf("Sqrt(%v) = %v, want %v", input, got, want)

// Incorrect — reversed order
t.Errorf("Sqrt(%v): expected %v, got %v", input, want, got)
```

For struct comparisons, the `cmp.Diff` output uses `(-want +got)` — put `want` as the first
argument to `cmp.Diff` so the signs are consistent with this convention.

---

## Interface-Based Mocking

Go's implicit interfaces make dependency injection natural. Prefer hand-rolled fakes for simple
cases — they are readable, have no external dependency, and are easy to extend.

```go
// Interface defined in the production code
type EmailSender interface {
    Send(to, subject, body string) error
}

// Hand-rolled fake for tests
type fakeEmailSender struct {
    sent []sentEmail
    err  error // set to simulate failures
}

type sentEmail struct{ to, subject, body string }

func (f *fakeEmailSender) Send(to, subject, body string) error {
    if f.err != nil {
        return f.err
    }
    f.sent = append(f.sent, sentEmail{to, subject, body})
    return nil
}

func TestNotifyUser_SendsWelcomeEmail(t *testing.T) {
    sender := &fakeEmailSender{}
    svc := NewNotificationService(sender)

    if err := svc.NotifyUser("alice@example.com", "Welcome"); err != nil {
        t.Fatalf("NotifyUser: unexpected error: %v", err)
    }

    if len(sender.sent) != 1 {
        t.Fatalf("got %d emails sent, want 1", len(sender.sent))
    }
    if sender.sent[0].to != "alice@example.com" {
        t.Errorf("email To = %q, want %q", sender.sent[0].to, "alice@example.com")
    }
}
```

Use `testify/mock` or `gomock` (generated mocks) only when the interface has many methods and a
hand-rolled fake would be impractical to maintain.

---

## HTTP Handler Testing

Use `net/http/httptest` from the standard library — no third-party package needed.

```go
import (
    "net/http"
    "net/http/httptest"
    "testing"
)

func TestGetUserHandler(t *testing.T) {
    tests := []struct {
        name       string
        userID     string
        wantStatus int
    }{
        {name: "valid user ID", userID: "1", wantStatus: http.StatusOK},
        {name: "unknown user ID", userID: "999", wantStatus: http.StatusNotFound},
        {name: "non-numeric ID", userID: "abc", wantStatus: http.StatusBadRequest},
    }

    for _, tc := range tests {
        t.Run(tc.name, func(t *testing.T) {
            req := httptest.NewRequest(http.MethodGet, "/users/"+tc.userID, nil)
            rec := httptest.NewRecorder()

            handler := NewGetUserHandler(fakeUserRepo)
            handler.ServeHTTP(rec, req)

            if rec.Code != tc.wantStatus {
                t.Errorf("status = %d, want %d", rec.Code, tc.wantStatus)
            }
        })
    }
}
```

---

## Integration Tests (Build Constraints)

Tag integration tests with a build constraint so they are excluded from the default `go test ./...`
run. The build constraint must be the first line of the file, followed by a blank line.

```go
//go:build integration

package user_test

import (
    "context"
    "testing"
)

func TestUserRepository_SaveAndRetrieve(t *testing.T) {
    // connects to a real database
    db := openTestDB(t)
    repo := NewUserRepository(db)

    user := &User{Name: "Alice", Email: "alice@example.com"}
    id, err := repo.Save(context.Background(), user)
    if err != nil {
        t.Fatalf("Save: %v", err)
    }

    got, err := repo.Get(context.Background(), id)
    if err != nil {
        t.Fatalf("Get: %v", err)
    }

    if diff := cmp.Diff(user, got, cmpopts.IgnoreFields(User{}, "ID")); diff != "" {
        t.Errorf("retrieved user mismatch (-want +got):\n%s", diff)
    }
}
```

Run commands:
```bash
# Unit tests only (default — integration tag excluded)
go test ./...

# Integration tests only
go test -tags=integration ./...

# Both
go test -tags=integration -race ./...
```

---

## `testdata/` Directory

Store fixture files in `testdata/` adjacent to the test file. The Go toolchain ignores
`testdata/` during builds — it is the standard location for test input files.

```go
func TestParseConfigFile(t *testing.T) {
    data, err := os.ReadFile("testdata/valid_config.json")
    if err != nil {
        t.Fatalf("reading testdata: %v", err)
    }

    cfg, err := ParseConfig(string(data))
    if err != nil {
        t.Fatalf("ParseConfig: %v", err)
    }

    if cfg.Port != 8080 {
        t.Errorf("Port = %d, want 8080", cfg.Port)
    }
}
```

---

## Race Detector

Always run tests with the race detector in CI. This is a Go team recommendation for all code
involving goroutines, channels, or shared state.

```bash
go test -race ./...
```

The race detector adds ~5-10x runtime overhead but detects data races that are otherwise nearly
impossible to reproduce. Run it on every CI push.

---

## Fuzz Testing (Go 1.18+)

For functions that parse external input (JSON, bytes, user strings), generate a fuzz function
alongside unit tests. Fuzz testing is built into the toolchain — no external package required.

```go
func FuzzParseConfig(f *testing.F) {
    // Seed corpus — provide known-valid and known-invalid inputs
    f.Add(`{"port": 8080}`)
    f.Add(`{}`)
    f.Add(``)

    f.Fuzz(func(t *testing.T, input string) {
        // The function must not panic on any input — if it does, it is a bug
        _, _ = ParseConfig(input)
    })
}
```

Run the seed corpus as part of the normal test run (fast, suitable for CI):
```bash
go test ./...
```

Run the fuzzer to explore new inputs (slow, for local or scheduled runs):
```bash
go test -fuzz=FuzzParseConfig -fuzztime=30s ./...
```

Found failures are written to `testdata/fuzz/<FuzzFuncName>/` and replayed on every subsequent
`go test` run — they become permanent regression tests.

---

## Benchmarking

```go
func BenchmarkSort(b *testing.B) {
    data := generateTestData(1000) // expensive setup
    b.ResetTimer()                 // reset timer after setup — do not measure setup cost

    for b.Loop() { // Go 1.24+ — b.Loop() prevents dead code elimination by the compiler
        sort.Ints(data)
    }
}
```

For Go versions before 1.24, use the legacy `b.N` loop:
```go
for i := 0; i < b.N; i++ {
    sort.Ints(data)
}
```

### Key benchmark flags

```bash
# Report memory allocations alongside timing
go test -bench=. -benchmem ./...

# Minimum 10 samples for statistical validity
go test -bench=. -benchmem -count=10 ./...

# Run only a specific benchmark
go test -bench=BenchmarkSort -benchmem -count=10 ./...
```

### Comparing benchmarks with benchstat

`benchstat` performs statistically rigorous A/B comparison with p-values. It is maintained by
the Go team as part of `golang.org/x/perf`.

Install:
```bash
go install golang.org/x/perf/cmd/benchstat@latest
```

Standard comparison workflow:
```bash
# 1. Capture baseline (before changes)
go test -bench=. -count=10 ./... > old.txt

# 2. Make code changes

# 3. Capture new results
go test -bench=. -count=10 ./... > new.txt

# 4. Compare — reports median, 95% CI, delta %, p-value
benchstat old.txt new.txt
```

A p-value > 0.05 means the difference is not statistically significant — benchstat reports `~`.
A 5% change with no p-value is not a meaningful benchmark result. Always use `-count=10` minimum.

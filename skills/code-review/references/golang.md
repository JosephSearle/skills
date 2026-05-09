# Go Code Review Reference

Style authority: [Google Go Style Guide](https://google.github.io/styleguide/go/)
— [Guide](https://google.github.io/styleguide/go/guide) | [Decisions](https://google.github.io/styleguide/go/decisions) | [Best Practices](https://google.github.io/styleguide/go/best-practices)

Apply these checks to all `.go` files in the diff. Use the four-field format when posting comments.

---

## Error Handling

### Unchecked error return
- **Look for:** `doThing()` with no assignment, or `_, err` where `err` is never checked, or `err` assigned but never used in a condition
- **Why:** Discarded errors make failures invisible in production and violate the Go contract that callers must handle errors
- **Suggest:** `if err := doThing(); err != nil { return fmt.Errorf("context: %w", err) }`
- **Severity:** blocker

### Error not wrapped with context
- **Look for:** `return err` inside a function that adds meaningful context, without `fmt.Errorf("...: %w", err)`
- **Why:** Unwrapped errors lose call-site context, making stack traces and logs impossible to trace. Google style requires errors to be wrapped with context at each layer
- **Suggest:** `return fmt.Errorf("loadUser %d: %w", id, err)`
- **Severity:** major

### Capitalised or punctuated error string
- **Look for:** `errors.New("Something went wrong.")` or `fmt.Errorf("Failed to load")`
- **Why:** Error strings are often concatenated by callers (`fmt.Errorf("outer: %w", err)`). Capitalisation and punctuation break the resulting string. Google style: lowercase, no trailing punctuation
- **Suggest:** `errors.New("something went wrong")` / `fmt.Errorf("failed to load")`
- **Severity:** minor

### Special sentinel value used instead of error
- **Look for:** Functions returning `-1`, `""`, or `nil` to signal failure with no accompanying `error` return
- **Why:** In-band error signals require callers to know the magic value, are invisible to the type system, and are easily ignored. Google style: use multiple return values with `error`
- **Suggest:** `func findUser(id int) (User, error)` not `func findUser(id int) *User`
- **Severity:** major

### `panic` used for normal error handling
- **Look for:** `panic(err)` or `panic("something went wrong")` outside of `init()`, `TestMain`, or truly impossible states
- **Why:** Panics crash the entire program. Google style reserves `panic` for unrecoverable states at initialisation. All recoverable errors must return `error`
- **Suggest:** Return the error instead. If it truly cannot be recovered, document why
- **Severity:** blocker

### `log.Fatal` called outside main
- **Look for:** `log.Fatal(...)` in non-main packages or library code
- **Why:** `log.Fatal` calls `os.Exit(1)` which bypasses deferred functions and is unkind to callers of library code. Google style: only use in `main` or `TestMain`
- **Suggest:** Return an error; let the caller decide how to terminate
- **Severity:** major

---

## Naming

### `Get` prefix on getter
- **Look for:** `func (t *T) GetName() string` or `func GetCount() int`
- **Why:** Google Go style explicitly prohibits `Get`/`get` prefixes on getters unless the underlying concept uses the word "get". The idiomatic form is just the noun
- **Suggest:** `func (t *T) Name() string` / `func Count() int`
- **Severity:** minor

### Initialism casing inconsistency
- **Look for:** `Url`, `Http`, `Id`, `Api`, `Json`, `Xml` in exported names
- **Why:** Google style: initialisms must be all-caps or all-lowercase consistently — `URL`, `url`, `HTTP`, `http`. Mixed case (`Url`, `Http`) is incorrect
- **Suggest:** `UserURL`, `parseHTTP`, `userID`, `jsonPayload`
- **Severity:** minor

### Receiver name is too long or inconsistent
- **Look for:** `func (tray Tray) Method()` or inconsistent receiver names across methods of the same type
- **Why:** Google style: receiver names should be one or two characters, abbreviated from the type name, and consistent across all methods of that type
- **Suggest:** `func (t Tray) Method()` — use `t` throughout all `Tray` methods
- **Severity:** nit

### Unexported type uses `MixedCaps`
- **Look for:** Unexported types, variables, or functions using `MixedCaps` or underscores (e.g. `my_variable`, `MyPrivateHelper`)
- **Why:** Google style: exported identifiers use `MixedCaps`; unexported use `mixedCaps`. Underscores are not idiomatic in Go names (except test functions and OS-level code)
- **Suggest:** `myPrivateHelper`, `myVariable`
- **Severity:** minor

### Package name is uninformative
- **Look for:** Package named `util`, `helper`, `common`, `misc`, `shared`
- **Why:** Vague package names obscure purpose and invite dumping unrelated code. Google style: package names should describe what they provide, be concise, and use no underscores
- **Suggest:** Rename to a noun that describes the primary concept: `auth`, `billing`, `metrics`
- **Severity:** major

---

## Interfaces

### Interface defined by the producer, not the consumer
- **Look for:** A package that defines an interface and also provides the concrete type implementing it, with no other implementors
- **Why:** Google style: interfaces should be defined by the consumer (the package that calls the methods), not the producer. Producer-defined interfaces create unnecessary coupling
- **Suggest:** Move the interface to the package that depends on the behaviour, or remove it until a second implementation exists
- **Severity:** major

### Interface created before a real need exists
- **Look for:** An interface with a single implementation and no tests using a mock/stub of that interface
- **Why:** Google decisions: "Avoid creating interfaces until a real need exists." Premature interfaces add indirection with no benefit
- **Suggest:** Use the concrete type directly until a second implementation or a testing need arises
- **Severity:** minor

### Function returns an interface instead of a concrete type
- **Look for:** `func NewFoo() FooInterface` where `FooInterface` is defined in the same package
- **Why:** Google style: "Functions should take interfaces as arguments but return concrete types." Returning interfaces hides the concrete type from callers and prevents them from accessing additional methods
- **Suggest:** Return the concrete type: `func NewFoo() *Foo`
- **Severity:** major

---

## Concurrency

### Goroutine with unclear lifetime
- **Look for:** `go func() { ... }()` where there is no `WaitGroup`, channel signal, or `context.Context` cancellation to bound the goroutine's lifetime
- **Why:** Google style: goroutine lifetimes must be clear. Leaked goroutines consume resources and make programs impossible to test reliably
- **Suggest:** Use a `sync.WaitGroup` and `defer wg.Done()`, or accept a `context.Context` and select on `ctx.Done()`
- **Severity:** blocker

### `math/rand` used for security-sensitive values
- **Look for:** `rand.Int()`, `rand.Read()`, or `rand.New(rand.NewSource(...))` used to generate tokens, keys, session IDs, or nonces
- **Why:** `math/rand` is not cryptographically secure. Google decisions explicitly state: "Do not use `math/rand` to generate keys." Predictable values allow attackers to forge tokens
- **Suggest:** Use `crypto/rand.Read(b)` or `crypto/rand.Int` for all security-sensitive random values
- **Severity:** blocker

### `sync.Mutex` copied by value
- **Look for:** A struct containing `sync.Mutex` passed by value, or a method with a value receiver on a type containing a mutex
- **Why:** Copying a mutex copies its internal state, breaking the mutual exclusion guarantee and causing data races
- **Suggest:** Always use a pointer receiver for types containing a mutex: `func (m *MyType) Method()`
- **Severity:** blocker

### `context.Context` stored in a struct
- **Look for:** A struct field of type `context.Context`
- **Why:** Google decisions explicitly prohibit storing context in structs. Context is request-scoped and should flow through function arguments, not be embedded in long-lived objects
- **Suggest:** Pass `ctx context.Context` as the first parameter of each function that needs it
- **Severity:** major

### `context.Context` not the first parameter
- **Look for:** Functions accepting `context.Context` where it is not the first parameter
- **Why:** Google style: "`context.Context` is always the first parameter." Consistent position makes context easy to find and satisfy linters
- **Suggest:** `func DoThing(ctx context.Context, arg string) error`
- **Severity:** minor

---

## Performance

### Slice or map not pre-allocated when size is known
- **Look for:** `var s []T` or `m := make(map[K]V)` inside a loop or before an append loop where the final size is known
- **Why:** Growing a slice or map repeatedly triggers repeated allocations and copies. Pre-allocating avoids this
- **Suggest:** `s := make([]T, 0, knownLen)` / `m := make(map[K]V, knownLen)`
- **Severity:** minor

### Pointer passed unnecessarily for a small value type
- **Look for:** Functions or methods accepting `*int`, `*bool`, `*string`, or other small scalar types where mutation is not the intent
- **Why:** Google decisions: "Don't pass pointers just to save bytes." For small types this adds indirection cost and obscures ownership. Pass values unless mutation or nil-ability is required
- **Suggest:** Accept the value type directly: `func Process(count int)` not `func Process(count *int)`
- **Severity:** nit

---

## Testing

### Test failure message missing got/want
- **Look for:** `t.Errorf("test failed")` or `t.Fatal("unexpected result")` with no information about what was received vs what was expected
- **Why:** Google testing guidance: test failure messages must identify the function, inputs, actual result (got), and expected result (want). Without this, failures require re-running with a debugger
- **Suggest:** `t.Errorf("Parse(%q) = %v, want %v", input, got, want)`
- **Severity:** major

### `reflect.DeepEqual` used in tests
- **Look for:** `reflect.DeepEqual(got, want)` in test files
- **Why:** Google decisions recommend `cmp.Equal` (from `github.com/google/go-cmp/cmp`) instead. `cmp.Diff` produces human-readable diffs on failure; `reflect.DeepEqual` produces none
- **Suggest:** `if diff := cmp.Diff(want, got); diff != "" { t.Errorf("mismatch (-want +got):\n%s", diff) }`
- **Severity:** minor

### `time.Sleep` in tests
- **Look for:** `time.Sleep(...)` in `*_test.go` files
- **Why:** Tests relying on `time.Sleep` are flaky by definition — they fail on slow machines and waste time on fast ones. Use channels, `sync.WaitGroup`, or `testing`-friendly concurrency primitives instead
- **Suggest:** Signal completion via a channel or use a ticker/watcher pattern
- **Severity:** major

### Non-table-driven test with repetitive cases
- **Look for:** Multiple `t.Run` blocks or repeated `if got != want` checks that share the same structure but test different inputs
- **Why:** Google style recommends table-driven tests for reducing duplication and making it easy to add cases
- **Suggest:** Use a `tests := []struct{ name, input, want string }{ ... }` slice and range over it with `t.Run(tc.name, ...)`
- **Severity:** nit

---

## Style

### Unnecessary `else` after `return`
- **Look for:** `if condition { return x } else { ... }`
- **Why:** Google decisions: handle errors (and returns) first, then continue with normal code. The `else` is redundant and adds unnecessary nesting
- **Suggest:** Remove the `else`; let the happy path continue at the same indentation level
- **Severity:** minor

### `gofmt` not applied
- **Look for:** Inconsistent indentation, misaligned struct fields, or spacing that differs from `gofmt` output
- **Why:** Google style: all Go source must conform to `gofmt` output. This is enforced via presubmit checks
- **Suggest:** Run `gofmt -w .` before committing
- **Severity:** major

### Exported symbol missing doc comment
- **Look for:** An exported function, type, method, or constant with no `// Name ...` doc comment
- **Why:** Google decisions: "All top-level exported names must have doc comments." Doc comments are the public API contract
- **Suggest:** Add `// FunctionName does X.` immediately above the declaration, beginning with the name of the symbol
- **Severity:** major

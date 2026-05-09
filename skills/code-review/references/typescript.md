# TypeScript Code Review Reference

Style authority: [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)

Apply these checks to all `.ts` and `.tsx` files in the diff.

---

## Type Safety

### `any` used without justification
- **Look for:** `: any` in type annotations, function signatures, or generic parameters without a suppression comment explaining why
- **Why:** Google style: "Never use `any` without strong justification." `any` opts out of the entire type system, spreading unsafety to all call sites. Use `unknown` when the type is genuinely unknown
- **Suggest:** Replace with a specific type, an interface, or `unknown` (which requires narrowing before use). If `any` is truly necessary, add a comment: `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
- **Severity:** major

### `unknown` not narrowed before use
- **Look for:** A value typed as `unknown` used directly without an `instanceof` check, `typeof` guard, or type assertion
- **Why:** `unknown` is the safe alternative to `any` only when narrowed before use. Using it unnarrowed provides no safety benefit
- **Suggest:** `if (err instanceof Error) { console.error(err.message); }`
- **Severity:** blocker

### `as` type assertion without justification
- **Look for:** `value as SomeType` where there is no comment explaining why the assertion is safe, especially on values from external sources
- **Why:** Type assertions bypass the type checker. If the assumption is wrong, the error surfaces at runtime rather than compile time. Google style requires these to be rare and justified
- **Suggest:** Use a type guard or `instanceof` check instead. If `as` is necessary, add a comment
- **Severity:** major

### Non-null assertion `!` used unnecessarily
- **Look for:** `value!.property` or `fn()!` where the non-null assertion is not clearly justified by surrounding logic
- **Why:** `!` tells the compiler "trust me, this is never null/undefined." If that assumption is wrong, the runtime throws. It should only be used when the developer has proven non-nullability that the type system cannot express
- **Suggest:** Check nullability explicitly: `if (value) { value.property }` or restructure so the type is non-nullable
- **Severity:** major

### `|null` or `|undefined` added to a type alias
- **Look for:** `type UserId = string | null` or `type Config = Settings | undefined`
- **Why:** Google style: "Do not include `|null` or `|undefined` in type aliases." Nullability should be expressed at the usage site, not baked into the alias, so it remains composable
- **Suggest:** Define `type UserId = string` and use `UserId | null` at the usage site where null is possible
- **Severity:** minor

### Implicit `any` on untyped parameter
- **Look for:** Function parameters or return types with no annotation where the type cannot be trivially inferred
- **Why:** Without annotations on non-obvious types, the compiler may infer `any`, and future readers have to trace the type manually
- **Suggest:** Add explicit annotations to function parameters and return types for non-trivial cases
- **Severity:** minor

---

## Imports & Exports

### Default export used
- **Look for:** `export default class Foo` or `export default function bar`
- **Why:** Google style: "Use named exports exclusively; avoid default exports." Default exports can be imported under any name, making codebase-wide renaming and search unreliable
- **Suggest:** `export class Foo {}` / `export function bar() {}`
- **Severity:** major

### `require()` used instead of ES module imports
- **Look for:** `const x = require('module')` or `const { x } = require('module')`
- **Why:** Google style requires ES6 module syntax. `require()` is CommonJS and bypasses TypeScript's module resolution and type checking
- **Suggest:** `import { x } from 'module'`
- **Severity:** major

### Mutable value exported with `export let`
- **Look for:** `export let count = 0` or `export let config = {}`
- **Why:** Google style: "Never use mutable exports." Mutable module-level state creates hidden coupling between consumers and makes modules non-deterministic
- **Suggest:** Export a getter function: `let _count = 0; export function getCount() { return _count; }`
- **Severity:** major

### `@ts-ignore` used
- **Look for:** `// @ts-ignore` anywhere in the diff
- **Why:** Google style explicitly prohibits `@ts-ignore` and `@ts-nocheck`. They silence the type checker entirely for a line or file, hiding errors that may be real
- **Suggest:** Use `@ts-expect-error` (in tests only) with a specific comment explaining what error is expected and why
- **Severity:** major

---

## Language Features

### `var` used instead of `const` or `let`
- **Look for:** `var x = ...`
- **Why:** Google style: always use `const` by default, `let` only when reassignment is needed, never `var`. `var` has function scope and hoisting behaviour that causes subtle bugs
- **Suggest:** `const x = ...` or `let x = ...` if reassignment is required
- **Severity:** major

### `const` not used where value is never reassigned
- **Look for:** `let x = value` where `x` is never reassigned after declaration
- **Why:** Google style: "Always use `const` by default." Using `let` for non-reassigned values signals reassignment intent that doesn't exist, misleading readers
- **Suggest:** `const x = value`
- **Severity:** minor

### `==` or `!=` used instead of `===` / `!==`
- **Look for:** `x == y` or `x != y` (unless `x == null` which is the permitted exception)
- **Why:** Google style: "Always use `===` and `!==`." Loose equality performs type coercion with non-obvious results. The only permitted exception is `== null` which checks both `null` and `undefined`
- **Suggest:** `x === y` / `x !== y`
- **Severity:** major

### Error thrown is not an `Error` instance
- **Look for:** `throw "something went wrong"` or `throw { message: "..." }`
- **Why:** Google style: "Always throw `Error` instances or subclasses, never strings." Only `Error` instances carry a stack trace, which is essential for debugging
- **Suggest:** `throw new Error("something went wrong")` or a subclass: `throw new ValidationError("...")`
- **Severity:** major

### `catch` block with no error handling and no comment
- **Look for:** `catch (e) { }` or `catch { }` with an empty body and no comment
- **Why:** Google style: catch blocks must either handle the error or include a comment explaining why the error is intentionally ignored. Silent swallowing of errors is a reliability risk
- **Suggest:** Handle the error, rethrow it, or add: `// Intentionally ignored: <reason>`
- **Severity:** blocker

### `eval()` or `Function` constructor used
- **Look for:** `eval(...)`, `new Function(...)`, or `setTimeout(string, ...)`
- **Why:** Google style explicitly disallows `eval()` and the `Function()` constructor. They execute arbitrary strings as code and are a critical XSS vector when any part of the input is user-controlled
- **Suggest:** Replace with a function reference or a lookup table
- **Severity:** blocker

### Prototype modified
- **Look for:** `Array.prototype.foo = ...` or `Object.prototype.bar = ...`
- **Why:** Google style: "Never modify built-in prototypes." Prototype modification affects all code in the process and causes hard-to-diagnose conflicts with other libraries
- **Suggest:** Use a utility function or subclass instead
- **Severity:** blocker

---

## Naming

### Class, interface, or type name uses non-UpperCamelCase
- **Look for:** `interface user_profile` or `type apiResponse = ...` or `class authService`
- **Why:** Google style: classes, interfaces, types, and enums use `UpperCamelCase`
- **Suggest:** `interface UserProfile`, `type ApiResponse`, `class AuthService`
- **Severity:** minor

### Variable, function, or method name uses non-lowerCamelCase
- **Look for:** `function Get_User()` or `const UserName = ...`
- **Why:** Google style: variables, parameters, functions, and methods use `lowerCamelCase`
- **Suggest:** `function getUser()`, `const userName`
- **Severity:** minor

### Constant not in `CONSTANT_CASE`
- **Look for:** `const maxRetries = 3` or `const apiTimeout = 5000` at module scope (not inside a function)
- **Why:** Google style: global constants and `static readonly` properties use `CONSTANT_CASE`
- **Suggest:** `const MAX_RETRIES = 3`, `const API_TIMEOUT_MS = 5000`
- **Severity:** nit

### Initialism treated as a regular word
- **Look for:** `loadHttpUrl`, `parseXml`, `getUserId`
- **Why:** Google style: abbreviations are treated as words (`loadHttpUrl`), but initialisations are all-caps (`URL`, `XML`, `ID`). The correct forms are `loadHttpUrl` ✓ but `getUserID` ✓ not `getUserId`
- **Suggest:** `loadHttpUrl` → already correct; `getUserId` → `getUserID`
- **Severity:** nit

---

## Null & Undefined

### Optional field used where `| undefined` should be explicit
- **Look for:** A function parameter typed as `param: string | undefined` that would be clearer as `param?: string`
- **Why:** Google style prefers optional fields (`field?`) over `|undefined` in type annotations for parameters and object properties. It is more concise and idiomatic
- **Suggest:** `function foo(param?: string)` not `function foo(param: string | undefined)`
- **Severity:** nit

### Class field not initialised, allowing shape changes
- **Look for:** A class field declared but not initialised in the constructor or at declaration: `private name: string;`
- **Why:** Google style: "Initialise class fields to prevent shape changes." Uninitialised fields create objects with changing shapes, which degrades V8 optimisation
- **Suggest:** `private name: string = '';` or initialise in the constructor
- **Severity:** minor

---

## Testing

### `any` used in test types
- **Look for:** Test stubs, mocks, or spy assertions typed as `any`
- **Why:** `any` in tests hides type errors in the code under test. If a refactor changes a function's signature, tests using `any` will still pass
- **Suggest:** Type mocks and stubs explicitly, or use `@ts-expect-error` with a comment where unavoidable
- **Severity:** major

### `debugger` statement left in code
- **Look for:** `debugger;` anywhere in the diff
- **Why:** Google style explicitly prohibits `debugger` statements in committed code. They halt execution in any environment where DevTools are open
- **Suggest:** Remove before committing
- **Severity:** blocker

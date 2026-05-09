# Terraform Code Review Reference

Style authority: [HashiCorp Terraform Style Guide](https://developer.hashicorp.com/terraform/language/style)

Apply these checks to all `.tf` and `.tfvars` files in the diff.

---

## Formatting

### `terraform fmt` not applied
- **Look for:** Inconsistent indentation (not 2 spaces per nesting level), misaligned equals signs on consecutive single-line arguments at the same nesting level, missing blank lines between arguments and nested blocks
- **Why:** HashiCorp style guide: run `terraform fmt` before committing. `terraform fmt` is the canonical formatter — its output is the expected style. Diffs that include formatting noise obscure the real change
- **Suggest:** Run `terraform fmt -recursive .` before committing. Add a pre-commit hook or CI step that fails if `terraform fmt -check` produces a diff
- **Severity:** minor

### Arguments not ordered correctly within a resource block
- **Look for:** Meta-arguments (`count`, `for_each`, `depends_on`, `lifecycle`) not placed first; nested blocks appearing before single-line arguments; `lifecycle` or `depends_on` not placed last
- **Why:** HashiCorp style guide specifies a consistent parameter order: (1) `count`/`for_each`, (2) resource-specific non-block arguments, (3) resource-specific block arguments, (4) `lifecycle`, (5) `depends_on`. Consistent ordering makes blocks predictable to read and review
- **Suggest:** Reorder arguments to match the prescribed sequence. Add a blank line between the last argument and the first nested block
- **Severity:** nit

### Top-level blocks not separated by a blank line
- **Look for:** Multiple `resource`, `variable`, `output`, or `data` blocks run together without a blank line between them
- **Why:** HashiCorp style guide: "Separate top-level blocks with one blank line." Blank lines between blocks aid readability and make the scope of each block immediately visible
- **Suggest:** Add one blank line between each top-level block. Group related blocks of the same type together
- **Severity:** nit

---

## Naming

### Resource name includes the resource type
- **Look for:** `resource "aws_instance" "aws_instance_web_api"` or `resource "aws_s3_bucket" "s3_bucket_uploads"`
- **Why:** HashiCorp style guide: "Use descriptive nouns; exclude the resource type from the name." The resource type is already in the block header — repeating it in the name is redundant and creates verbose references (`aws_instance.aws_instance_web_api` vs `aws_instance.web_api`)
- **Suggest:** `resource "aws_instance" "web_api"`, `resource "aws_s3_bucket" "uploads"`
- **Severity:** minor

### Name uses hyphens or camelCase instead of underscores
- **Look for:** Resource, variable, output, or local names using `-` (hyphens) or camelCase: `resource "aws_instance" "web-api"` or `var.webApiPort`
- **Why:** HashiCorp style guide: "Separate multiple words with underscores." Hyphens are not valid in all contexts and camelCase is non-idiomatic in HCL
- **Suggest:** `resource "aws_instance" "web_api"`, `variable "web_api_port"`
- **Severity:** minor

### Comment uses `//` or `/* */` instead of `#`
- **Look for:** `// this is a comment` or `/* multi-line comment */` in `.tf` files
- **Why:** HashiCorp style guide: "Use `#` for both single- and multi-line comments." The `//` and `/* */` forms are explicitly called out as non-idiomatic in HCL
- **Suggest:** Replace with `#` prefixed comments on each line
- **Severity:** nit

---

## File Organisation

### Resources placed in the wrong file
- **Look for:** Provider blocks outside `providers.tf`, output blocks outside `outputs.tf`, variable blocks outside `variables.tf`, or the `terraform {}` block outside `terraform.tf`
- **Why:** HashiCorp style guide defines standard file names with clear purposes. Consistent file organisation means any contributor knows exactly where to find or add each block type without searching
- **Suggest:** Follow the standard layout: `backend.tf` (backend), `main.tf` (resources and data sources), `outputs.tf` (all outputs, alphabetical), `providers.tf` (providers), `terraform.tf` (terraform block), `variables.tf` (all variables, alphabetical), `locals.tf` (local values)
- **Severity:** major

### Variables or outputs not in alphabetical order
- **Look for:** `variables.tf` or `outputs.tf` where blocks are not sorted alphabetically by name
- **Why:** HashiCorp style guide: "List variable blocks in alphabetical order" and "List output blocks in alphabetical order." Alphabetical order makes it fast to locate a specific variable or output in large files and prevents duplicates
- **Suggest:** Sort all `variable` blocks in `variables.tf` and all `output` blocks in `outputs.tf` alphabetically by their label
- **Severity:** nit

### Data sources defined after the resources that reference them
- **Look for:** A `data` block appearing after the `resource` block that uses `data.<type>.<name>` to reference it
- **Why:** HashiCorp style guide: "Define data sources before resources that reference them." Placing data sources first means the file reads sequentially — the reader sees what is being looked up before seeing it used
- **Suggest:** Move all `data` blocks above the resources that depend on them
- **Severity:** nit

---

## Variables

### Variable missing `type` or `description`
- **Look for:** A `variable` block with no `type` argument, no `description` argument, or both missing
- **Why:** HashiCorp style guide: "Include type and description for every variable." Without a type, Terraform accepts any value and type errors surface at plan time rather than immediately. Without a description, the variable's purpose is opaque to consumers of the module
- **Suggest:** Add both fields: `type = string` (or the appropriate type constraint) and `description = "..."` explaining what the variable controls and any constraints
- **Severity:** major

### Sensitive variable not marked `sensitive = true`
- **Look for:** Variables named with patterns like `password`, `secret`, `key`, `token`, `credential`, or `private_key` that do not have `sensitive = true`
- **Why:** HashiCorp style guide: "For sensitive variables, such as passwords and private keys, set the `sensitive` parameter to `true`." Without this, Terraform prints the value in plan and apply output, exposing it in CI logs and terminal history
- **Suggest:** Add `sensitive = true` to the variable definition. Note: Terraform will still write these values in plaintext to the state file — ensure the state backend is encrypted and access-controlled
- **Severity:** major

### Variable overused where a local or direct reference would be clearer
- **Look for:** Variables that are set to a constant value in all environments, never passed from outside the module, or simply proxying a value from one resource to another
- **Why:** HashiCorp style guide: "Avoid overusing variables; they can obscure code intent." Excessive variables add indirection that makes the configuration harder to follow without enabling meaningful reuse
- **Suggest:** Replace with a `local` value or a direct reference. Reserve variables for values that genuinely vary between environments or callers
- **Severity:** nit

---

## Outputs

### Output missing `description`
- **Look for:** An `output` block with no `description` argument
- **Why:** HashiCorp style guide requires `description` on every output. Outputs are the public API of a module — without descriptions, consumers cannot understand what each output represents or how to use it
- **Suggest:** Add `description = "..."` explaining what the value is and when it should be used
- **Severity:** major

### Sensitive output not marked `sensitive = true`
- **Look for:** Outputs that expose credentials, private keys, tokens, or connection strings without `sensitive = true`
- **Why:** Unmarked sensitive outputs are printed in `terraform output` and in CI apply logs. Any secret surfaced this way is immediately exposed to anyone with access to those logs
- **Suggest:** Add `sensitive = true` to the output definition. Consumers that need the value must use `nonsensitive()` explicitly, making the exposure intentional and visible
- **Severity:** major

---

## Version Pinning

### Provider version not pinned
- **Look for:** A `required_providers` block with a version constraint using `>=` only (e.g. `version = ">= 4.0"`) or no version constraint at all
- **Why:** HashiCorp style guide: "Pin provider versions using `required_providers`." An unpinned provider allows breaking changes from major version bumps to silently apply on the next `terraform init`. The `.terraform.lock.hcl` file pins the exact version for existing checkouts, but a new checkout without a lock file can pull a different version
- **Suggest:** Use a pessimistic constraint operator to allow patches but not major/minor bumps: `version = "~> 4.0"`. Commit `.terraform.lock.hcl` to version control
- **Severity:** major

### Terraform version not constrained
- **Look for:** A `terraform {}` block with no `required_version` argument, or `required_version = ">= 0.13"` with no upper bound
- **Why:** Without a version constraint, the configuration may be applied with an incompatible Terraform version, causing unexpected plan diffs or state corruption. Teams sharing infrastructure benefit from a consistent Terraform version
- **Suggest:** Add `required_version = "~> 1.9"` (or the specific version in use). Enforce via CI by installing the pinned version explicitly
- **Severity:** major

### Module version not pinned
- **Look for:** A `module` block sourcing from a registry or Git URL with `version = ">= x.y"` or no version at all
- **Why:** HashiCorp style guide: "Pin module versions to specific major/minor versions." An unpinned module source can silently pull a new version with breaking changes on the next `terraform init`
- **Suggest:** Pin to a specific version: `version = "~> 3.2"`. For Git sources, pin to a tag or commit hash: `source = "git::https://...?ref=v3.2.0"`
- **Severity:** major

### `.terraform.lock.hcl` not committed
- **Look for:** `.terraform.lock.hcl` added to `.gitignore`, or a PR that modifies providers without including a lock file update
- **Why:** HashiCorp style guide: always commit `.terraform.lock.hcl`. The lock file records the exact provider versions and checksums used, ensuring consistent installs across machines and CI
- **Suggest:** Remove `.terraform.lock.hcl` from `.gitignore`. Commit the lock file as part of any provider version change PR
- **Severity:** major

---

## Dynamic Resource Creation

### `for_each` used where `count` is more appropriate, or vice versa
- **Look for:** `count` used with a list of maps or objects that have distinct attributes, requiring `count.index` to access values; or `for_each` used where resources are truly identical and only the number varies
- **Why:** HashiCorp style guide: "Use `count` when resources are nearly identical; use `for_each` when arguments require distinct values not derivable from integers." Using `count` with complex lists creates fragile plans — inserting an item changes all subsequent indices, causing unwanted destroy/create cycles
- **Suggest:** For resources with distinct identities or configuration, use `for_each = { for item in var.items : item.name => item }`. Reserve `count` for truly homogeneous resources where an integer is the natural descriptor
- **Severity:** major

### `count` or `for_each` logic has no explanatory comment
- **Look for:** Non-obvious `count` expressions (e.g. `count = var.create_resource ? 1 : 0` with no comment, or complex `for_each` transforms) with no inline comment explaining the intent
- **Why:** HashiCorp style guide: "Add comments when meta-argument logic is non-obvious." Complex conditional or iteration logic is the most common source of confusion in Terraform reviews
- **Suggest:** Add a `# comment` above the meta-argument explaining why the condition exists and what it controls
- **Severity:** nit

---

## Local Values

### `locals` overused, obscuring the configuration
- **Look for:** Locals used for trivial string concatenation that would be clearer inline, or deeply nested local references where the original value is several hops away
- **Why:** HashiCorp style guide: "Use local values sparingly, as overuse can make your code harder to understand." Locals are valuable for eliminating repetition and creating shared values — not for every intermediate expression
- **Suggest:** Inline simple expressions. Reserve locals for values used in three or more places, or for complex expressions that genuinely benefit from a named abstraction
- **Severity:** nit

### Locals used across files defined outside `locals.tf`
- **Look for:** A `locals {}` block defined in `main.tf`, `network.tf`, or another resource file when the values it defines are referenced in multiple other files
- **Why:** HashiCorp style guide: "If referenced across files, define in `locals.tf`." Cross-file locals buried in resource files are hard to discover and maintain
- **Suggest:** Move shared locals to `locals.tf`. File-specific locals may remain at the top of the file that uses them exclusively
- **Severity:** minor

---

## Security

### Hardcoded credential or secret in `.tf` or `.tfvars` file
- **Look for:** AWS access keys, passwords, API tokens, private key material, or connection strings as literal string values in any `.tf` or `.tfvars` file
- **Why:** Terraform files are committed to version control. Hardcoded secrets are permanently exposed in git history and to everyone with repository access. HashiCorp style guide: "Access secrets from systems like Vault using provider integrations" and "configure credentials via environment variables"
- **Suggest:** Load secrets from environment variables (`TF_VAR_db_password`), a secrets manager (HashiCorp Vault, AWS Secrets Manager), or use dynamic provider credentials. Never commit `.tfvars` files containing secrets — add them to `.gitignore`
- **Severity:** blocker

### Sensitive `.tfvars` file committed to the repository
- **Look for:** Files named `*.tfvars` or `*.tfvars.json` added or modified in the PR, particularly those containing non-default values for sensitive variables
- **Why:** HashiCorp style guide: do not commit sensitive `.tfvars` files. These files often contain environment-specific secrets and credentials that must not be in version control
- **Suggest:** Add `*.tfvars` to `.gitignore` (except `terraform.tfvars.example` with placeholder values). Supply sensitive values via CI environment variables or a secrets manager
- **Severity:** blocker

### State file committed to the repository
- **Look for:** `terraform.tfstate`, `terraform.tfstate.backup`, or `*.tfstate.*` files added in the PR
- **Why:** HashiCorp style guide: do not commit state files. State files contain sensitive data in plaintext — resource IDs, connection strings, and any value Terraform writes to state (including `sensitive = true` variables). Committing state also prevents collaboration as concurrent applies will conflict
- **Suggest:** Add `*.tfstate`, `*.tfstate.*`, and `.terraform/` to `.gitignore`. Use a remote backend (S3 + DynamoDB, HCP Terraform, GCS) with state locking and encryption
- **Severity:** blocker

### Remote backend not configured
- **Look for:** No `backend {}` block in `terraform.tf` or `backend.tf`, meaning Terraform defaults to local state storage
- **Why:** Local state cannot be shared between team members or CI pipelines, does not support state locking (risking concurrent apply conflicts), and is not encrypted. Any production or shared infrastructure must use a remote, encrypted, access-controlled backend
- **Suggest:** Configure a remote backend appropriate for the environment: S3 + DynamoDB (AWS), GCS (GCP), Azure Blob Storage, or HCP Terraform. Enable encryption and access controls on the backend storage
- **Severity:** major

### Overly permissive security group or firewall rule
- **Look for:** Security group rules, firewall rules, or network ACLs with `cidr_blocks = ["0.0.0.0/0"]` or `ipv6_cidr_blocks = ["::/0"]` on ports other than 80 and 443; SSH (22) or RDP (3389) open to the internet
- **Why:** Open ingress rules expose services to the entire internet. SSH and RDP open to `0.0.0.0/0` are among the most commonly exploited misconfigurations in cloud infrastructure
- **Suggest:** Restrict ingress to known IP ranges or security group IDs. For SSH/RDP, require a bastion host or VPN. Flag any `0.0.0.0/0` rule on non-HTTP ports for explicit security sign-off
- **Severity:** blocker

### IAM policy uses wildcard action or resource
- **Look for:** `"Action": "*"`, `"Action": "s3:*"`, `"Resource": "*"` in inline IAM policy documents within Terraform resources
- **Why:** Wildcard actions and resources violate the principle of least privilege. A compromised identity with `*` permissions can access or modify any resource in the account. This is a critical security misconfiguration and also flagged in the main `security.md` reference
- **Suggest:** Enumerate only the specific actions required: `["s3:GetObject", "s3:PutObject"]`. Scope resources to specific ARNs: `"arn:aws:s3:::my-bucket/*"`
- **Severity:** blocker

---

## Module Structure

### Module not stored under `./modules/<module_name>`
- **Look for:** Local module sources referenced from directories outside the `./modules/` directory, or module code mixed directly into the root module
- **Why:** HashiCorp style guide: "Store child modules in `./modules/<module_name>` directory." A consistent module location makes the repository structure immediately navigable
- **Suggest:** Move reusable module code to `./modules/<name>/` and update the `source` argument accordingly: `source = "./modules/network"`
- **Severity:** minor

### Module repository name does not follow the naming convention
- **Look for:** Registry-published module repositories not following the `terraform-<PROVIDER>-<NAME>` pattern
- **Why:** HashiCorp style guide: "Follow pattern: `terraform-<PROVIDER>-<NAME>` for registry modules." The Terraform Registry requires this format to correctly identify the provider and module name
- **Suggest:** Rename the repository to match: `terraform-aws-vpc`, `terraform-google-gke-cluster`
- **Severity:** minor

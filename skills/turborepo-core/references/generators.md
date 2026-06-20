# Turborepo Generators Reference

> Authority: [turborepo.dev/docs/guides/generating-code](https://turborepo.dev/docs/guides/generating-code) (v2.x)

`turbo gen` provides Plop-based code generation for scaffolding new packages, adding files, and running custom generators. It is built into the `turbo` CLI — no separate install required.

---

## Scaffold a new workspace package

```bash
# Interactive: prompts for name, location (apps/ or packages/), copy source
turbo gen workspace

# Copy from a remote example (GitHub URL or local path)
turbo gen workspace --copy https://github.com/vercel/turborepo/tree/main/examples/with-tailwind

# Non-interactive
turbo gen workspace --name @repo/ui --location packages/ui
```

This creates the package directory, populates `package.json` and `tsconfig.json`, and adds the package to `pnpm-workspace.yaml`.

---

## Custom generators

Custom generators live at `turbo/generators/config.ts` in the workspace root. Turborepo injects a `turbo` object alongside the standard Plop API.

```typescript
// turbo/generators/config.ts
import type { PlopTypes } from "@turbo/gen";

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.setGenerator("react-component", {
    description: "Add a new React component to @repo/ui",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Component name:",
      },
    ],
    actions: [
      {
        type: "add",
        path: "{{ turbo.paths.root }}/packages/ui/src/{{ name }}.tsx",
        templateFile: "templates/component.tsx.hbs",
      },
    ],
  });
}
```

Run a custom generator:
```bash
turbo gen react-component
```

---

## `@turbo/gen` types

Install as a dev dependency in the workspace root to get type support:

```bash
pnpm add -D @turbo/gen -w
```

The injected `turbo` object provides:

| Property | Value |
|----------|-------|
| `turbo.paths.root` | Absolute path to the workspace root |
| `turbo.paths.workspace` | Absolute path to the generator's package |
| `turbo.package.name` | Name of the package being generated into |

---

## Template files

Store Handlebars templates in `turbo/generators/templates/`:

```
turbo/
  generators/
    config.ts
    templates/
      component.tsx.hbs
      package.json.hbs
```

Use standard Plop/Handlebars syntax in templates. The `turbo` object is available as a template variable.

---

## Notes

- Generators run in the context of the workspace root, regardless of where `turbo gen` is invoked.
- `turbo gen workspace --copy <url>` fetches the example, strips git history, and adapts `package.json` names to the workspace convention.
- Generators are opt-in; the `turbo/generators/` directory is only required if you define custom generators.

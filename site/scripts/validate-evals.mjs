#!/usr/bin/env node
// Structural validation for catalog/*/evals/evals.json files.
//
// This does NOT execute evals against a model — it only checks that each
// evals.json is well-formed enough to be run later (by hand, or by a
// scripted runner if one is built). See catalog/*/evals/README.md for what
// "running" an eval currently means.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SITE_ROOT = path.resolve(__dirname, '..');
const DEFAULT_REPO_ROOT = path.resolve(DEFAULT_SITE_ROOT, '..');
const DEFAULT_CATALOG_ROOT = path.join(DEFAULT_REPO_ROOT, 'catalog');

const REQUIRED_EVAL_FIELDS = ['id', 'name', 'prompt', 'expected_output'];

function findEvalsFiles(catalogRoot) {
  return fs
    .readdirSync(catalogRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(catalogRoot, entry.name, 'evals', 'evals.json'))
    .filter((evalsPath) => fs.existsSync(evalsPath));
}

export function validateEvals({ catalogRoot = DEFAULT_CATALOG_ROOT } = {}) {
  const errors = [];
  const evalsFiles = findEvalsFiles(catalogRoot);

  for (const evalsPath of evalsFiles) {
    const slug = path.basename(path.dirname(path.dirname(evalsPath)));
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(evalsPath, 'utf-8'));
    } catch (err) {
      errors.push(`"${slug}": evals.json is not valid JSON: ${err.message}`);
      continue;
    }

    if (!parsed.skill_name) {
      errors.push(`"${slug}": evals.json is missing "skill_name"`);
    }

    if (!Array.isArray(parsed.evals) || parsed.evals.length === 0) {
      errors.push(`"${slug}": evals.json must have a non-empty "evals" array`);
      continue;
    }

    const seenIds = new Set();
    for (const [i, evalCase] of parsed.evals.entries()) {
      const label = `"${slug}" evals[${i}]`;
      const missing = REQUIRED_EVAL_FIELDS.filter((field) => !evalCase[field]);
      if (missing.length > 0) {
        errors.push(`${label}: missing required field(s): ${missing.join(', ')}`);
      }
      if (typeof evalCase.prompt === 'string' && evalCase.prompt.trim() === '') {
        errors.push(`${label}: "prompt" must not be empty`);
      }
      if (evalCase.id !== undefined) {
        if (seenIds.has(evalCase.id)) {
          errors.push(`${label}: duplicate eval id "${evalCase.id}"`);
        }
        seenIds.add(evalCase.id);
      }
    }
  }

  return { evalsFiles, errors };
}

async function main() {
  const { evalsFiles, errors } = validateEvals();

  if (errors.length > 0) {
    console.error(`Eval validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
    process.exit(1);
  }

  console.log(`Validated ${evalsFiles.length} evals.json file(s), structurally OK.`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}

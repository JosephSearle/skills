#!/usr/bin/env node
// Scans the repo's top-level skill folders and produces:
//   site/generated/skills-index.json  (metadata for the frontend, §5.1)
//   site/public/downloads/<slug>.skill (one zip archive per skill, §5.2)
//
// A top-level directory counts as a skill iff it directly contains a
// SKILL.md file (§3.1's inclusion rule) — this naturally skips
// `Claude outputs/`, `.git/`, `.gitignore`, `README.md`, `intent.md`,
// `spec.md`, and `site/` itself, with `.claude/` additionally excluded by
// name regardless (§3.2).

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const require = createRequire(import.meta.url);
const matter = require('gray-matter');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SITE_ROOT = path.resolve(__dirname, '..');
const DEFAULT_REPO_ROOT = path.resolve(DEFAULT_SITE_ROOT, '..');

const EXCLUDED_NAMES = new Set(['.claude', '.git', 'site', 'node_modules']);

function findSkillFolders(repoRoot) {
  return fs
    .readdirSync(repoRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !EXCLUDED_NAMES.has(entry.name))
    .filter((entry) =>
      fs.existsSync(path.join(repoRoot, entry.name, 'SKILL.md'))
    )
    .map((entry) => entry.name)
    .sort();
}

function listFilesRecursive(dir, baseDir = dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(fullPath, baseDir));
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).split(path.sep).join('/');
      results.push({ path: relPath, sizeBytes: fs.statSync(fullPath).size });
    }
  }
  return results;
}

function buildSkillArchive(slug, skillDir, downloadsDir) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(downloadsDir, `${slug}.skill`);
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      resolve({
        downloadPath: `/downloads/${slug}.skill`,
        downloadSizeBytes: fs.statSync(outputPath).size,
      });
    });
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(skillDir, slug);
    archive.finalize();
  });
}

// Builds the skills index and .skill archives for `repoRoot`, writing
// output under `siteRoot`/generated and `siteRoot`/public/downloads.
// Exported so a test can point both roots at a temp directory instead of
// the real repo (spec §7's fixture-skill smoke test).
export async function buildIndex({ repoRoot = DEFAULT_REPO_ROOT, siteRoot = DEFAULT_SITE_ROOT } = {}) {
  const generatedDir = path.join(siteRoot, 'generated');
  const downloadsDir = path.join(siteRoot, 'public', 'downloads');

  fs.mkdirSync(generatedDir, { recursive: true });
  fs.mkdirSync(downloadsDir, { recursive: true });

  const slugs = findSkillFolders(repoRoot);
  const errors = [];
  const warnings = [];
  const skills = [];

  for (const slug of slugs) {
    const skillDir = path.join(repoRoot, slug);
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    const raw = fs.readFileSync(skillMdPath, 'utf-8');
    const { data: frontmatter, content } = matter(raw);

    const missing = ['name', 'description', 'summary'].filter(
      (field) => !frontmatter[field]
    );
    if (missing.length > 0) {
      errors.push(`"${slug}": SKILL.md is missing required field(s): ${missing.join(', ')}`);
      continue;
    }

    if (frontmatter.name !== slug) {
      warnings.push(
        `"${slug}": frontmatter name "${frontmatter.name}" does not match folder name "${slug}"`
      );
    }

    const referencesDir = path.join(skillDir, 'references');
    const references = fs.existsSync(referencesDir)
      ? fs
          .readdirSync(referencesDir, { withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => ({
            title: entry.name,
            path: `references/${entry.name}`,
            sizeBytes: fs.statSync(path.join(referencesDir, entry.name)).size,
          }))
          .sort((a, b) => a.title.localeCompare(b.title))
      : [];

    const scriptsDir = path.join(skillDir, 'scripts');
    const hasScripts =
      fs.existsSync(scriptsDir) && fs.readdirSync(scriptsDir).length > 0;

    const evalsDir = path.join(skillDir, 'evals');
    const hasEvals =
      fs.existsSync(evalsDir) && fs.readdirSync(evalsDir).length > 0;

    const archiveTree = listFilesRecursive(skillDir).sort((a, b) =>
      a.path.localeCompare(b.path)
    );

    const { downloadPath, downloadSizeBytes } = await buildSkillArchive(
      slug,
      skillDir,
      downloadsDir
    );

    skills.push({
      slug,
      name: frontmatter.name,
      summary: frontmatter.summary,
      description: frontmatter.description,
      body: content.trim(),
      references,
      hasScripts,
      hasEvals,
      archiveTree,
      downloadPath,
      downloadSizeBytes,
    });
  }

  if (errors.length > 0) {
    const message = 'Skills index build failed:\n' + errors.map((e) => `  - ${e}`).join('\n');
    throw new Error(message);
  }

  for (const warning of warnings) {
    console.warn(`Warning: ${warning}`);
  }

  skills.sort((a, b) => a.slug.localeCompare(b.slug));

  const index = {
    generatedAt: new Date().toISOString(),
    skills,
  };

  fs.writeFileSync(
    path.join(generatedDir, 'skills-index.json'),
    JSON.stringify(index, null, 2)
  );

  return index;
}

async function main() {
  const index = await buildIndex();
  console.log(`Built skills index with ${index.skills.length} skill(s).`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}

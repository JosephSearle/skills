import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildIndex } from './build-skills-index.mjs';

let tempRoot;
let catalogRoot;
let siteRoot;

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-index-test-'));
  catalogRoot = path.join(tempRoot, 'repo', 'catalog');
  siteRoot = path.join(tempRoot, 'repo', 'site');
  fs.mkdirSync(catalogRoot, { recursive: true });
  fs.mkdirSync(siteRoot, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

function writeSkill(slug, frontmatter, body = '# Body\n\nHello.') {
  const skillDir = path.join(catalogRoot, slug);
  fs.mkdirSync(skillDir, { recursive: true });
  const fm = Object.entries(frontmatter)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `---\n${fm}\n---\n\n${body}`);
  return skillDir;
}

describe('buildIndex', () => {
  it('adding a new top-level folder with a valid SKILL.md is enough to appear in the index (§7 acceptance criterion)', async () => {
    writeSkill('fixture-skill', {
      name: 'fixture-skill',
      description: 'A fixture skill used for the smoke test.',
      summary: 'A one-line human summary of the fixture skill.',
    });

    const index = await buildIndex({ catalogRoot, siteRoot });

    expect(index.skills).toHaveLength(1);
    expect(index.skills[0]).toMatchObject({
      slug: 'fixture-skill',
      name: 'fixture-skill',
      summary: 'A one-line human summary of the fixture skill.',
      description: 'A fixture skill used for the smoke test.',
    });
    expect(index.skills[0].body).toContain('Hello.');

    const generatedPath = path.join(siteRoot, 'generated', 'skills-index.json');
    expect(fs.existsSync(generatedPath)).toBe(true);

    const archivePath = path.join(siteRoot, 'public', 'downloads', 'fixture-skill.skill');
    expect(fs.existsSync(archivePath)).toBe(true);
  });

  it('fails the build with a clear message when summary is missing', async () => {
    writeSkill('broken-skill', {
      name: 'broken-skill',
      description: 'Has a description but no summary.',
    });

    await expect(buildIndex({ catalogRoot, siteRoot })).rejects.toThrow(/broken-skill.*summary/s);
  });

  it('warns but does not fail when frontmatter name does not match the folder', async () => {
    writeSkill('folder-name', {
      name: 'different-name',
      description: 'Mismatched name.',
      summary: 'Mismatched name summary.',
    });

    const index = await buildIndex({ catalogRoot, siteRoot });
    expect(index.skills).toHaveLength(1);
  });

  it('records references, hasScripts, and hasEvals correctly', async () => {
    const skillDir = writeSkill('full-skill', {
      name: 'full-skill',
      description: 'Has references, scripts, and evals.',
      summary: 'Full skill summary.',
    });
    fs.mkdirSync(path.join(skillDir, 'references'));
    fs.writeFileSync(path.join(skillDir, 'references', 'notes.md'), '# Notes');
    fs.mkdirSync(path.join(skillDir, 'scripts'));
    fs.writeFileSync(path.join(skillDir, 'scripts', 'run.py'), 'print(1)');
    fs.mkdirSync(path.join(skillDir, 'evals'));
    fs.writeFileSync(path.join(skillDir, 'evals', 'evals.json'), '[]');

    const index = await buildIndex({ catalogRoot, siteRoot });
    const skill = index.skills[0];

    expect(skill.hasScripts).toBe(true);
    expect(skill.hasEvals).toBe(true);
    expect(skill.references).toEqual([
      { title: 'notes.md', path: 'references/notes.md', sizeBytes: expect.any(Number) },
    ]);
  });
});

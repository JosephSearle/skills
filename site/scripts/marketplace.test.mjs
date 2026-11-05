// Guards the repo-root .claude-plugin/marketplace.json, which publishes catalog/ skills as the
// `core` and `sdlc` Claude Code plugins by pointing straight at catalog folders. Nothing else
// checks those paths, so a catalog rename would silently drop a skill from a plugin.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PERSONAS_PATH = path.join('catalog', 'sdlc-design', 'references', 'personas.md');

// Skill names listed in personas.md's table, e.g. `| personal | security-baseline, ux-personal |`.
function personaSkills(repoRoot) {
  const personasPath = path.join(repoRoot, PERSONAS_PATH);
  if (!fs.existsSync(personasPath)) return [];
  const skills = new Set();
  for (const line of fs.readFileSync(personasPath, 'utf-8').split('\n')) {
    const cells = line.split('|').map((cell) => cell.trim());
    // A table row splits into ['', persona, skills, ''].
    if (cells.length < 4 || cells[1] === 'Persona' || /^-+$/.test(cells[1])) continue;
    for (const skill of cells[2].split(',')) {
      if (skill.trim()) skills.add(skill.trim());
    }
  }
  return [...skills];
}

function checkMarketplace(repoRoot) {
  const errors = [];
  const marketplacePath = path.join(repoRoot, '.claude-plugin', 'marketplace.json');
  let marketplace;
  try {
    marketplace = JSON.parse(fs.readFileSync(marketplacePath, 'utf-8'));
  } catch (err) {
    return [`marketplace.json can't be read: ${err.message}`];
  }

  if (!marketplace.name) errors.push('marketplace is missing "name"');
  if (!marketplace.owner?.name) errors.push('marketplace is missing "owner.name"');
  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
    errors.push('marketplace must have a non-empty "plugins" array');
    return errors;
  }

  const names = marketplace.plugins.map((plugin) => plugin.name);
  for (const name of new Set(names)) {
    if (names.filter((n) => n === name).length > 1) errors.push(`duplicate plugin "${name}"`);
  }

  for (const plugin of marketplace.plugins) {
    const label = `plugin "${plugin.name}"`;
    if (plugin.source !== './') {
      errors.push(`${label}: "source" must be "./" so skills resolve from catalog/`);
    }
    for (const skillPath of plugin.skills ?? []) {
      if (!skillPath.startsWith('./catalog/')) {
        errors.push(`${label}: skill path "${skillPath}" must start with "./catalog/"`);
      } else if (!fs.existsSync(path.join(repoRoot, skillPath, 'SKILL.md'))) {
        errors.push(`${label}: "${skillPath}" has no SKILL.md (renamed or removed?)`);
      }
    }
    for (const dependency of plugin.dependencies ?? []) {
      if (!names.includes(dependency)) {
        errors.push(`${label}: depends on "${dependency}", which isn't in this marketplace`);
      }
    }
  }

  const core = marketplace.plugins.find((plugin) => plugin.name === 'core');
  const coreSkills = (core?.skills ?? []).map((skillPath) => path.posix.basename(skillPath));
  for (const skill of personaSkills(repoRoot)) {
    if (!coreSkills.includes(skill)) {
      errors.push(`personas.md names "${skill}", but the core plugin doesn't ship it`);
    }
  }

  return errors;
}

describe('repo marketplace.json', () => {
  it('points every plugin at real catalog skills and ships every persona policy skill in core', () => {
    expect(checkMarketplace(REPO_ROOT)).toEqual([]);
  });
});

describe('checkMarketplace', () => {
  let tempRoot;

  function writeFixture({ plugins, personas = '' }) {
    fs.mkdirSync(path.join(tempRoot, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(
      path.join(tempRoot, '.claude-plugin', 'marketplace.json'),
      JSON.stringify({ name: 'fixture', owner: { name: 'Fixture' }, plugins }),
    );
    for (const plugin of plugins) {
      for (const skillPath of plugin.skills ?? []) {
        if (skillPath.includes('missing')) continue;
        fs.mkdirSync(path.join(tempRoot, skillPath), { recursive: true });
        fs.writeFileSync(path.join(tempRoot, skillPath, 'SKILL.md'), '---\nname: x\n---\n');
      }
    }
    if (personas) {
      fs.mkdirSync(path.dirname(path.join(tempRoot, PERSONAS_PATH)), { recursive: true });
      fs.writeFileSync(path.join(tempRoot, PERSONAS_PATH), personas);
    }
  }

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'marketplace-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('accepts a valid marketplace', () => {
    writeFixture({ plugins: [{ name: 'core', source: './', skills: ['./catalog/a'] }] });
    expect(checkMarketplace(tempRoot)).toEqual([]);
  });

  it('reports a skill path whose catalog folder is gone', () => {
    writeFixture({ plugins: [{ name: 'core', source: './', skills: ['./catalog/missing'] }] });
    expect(checkMarketplace(tempRoot)).toEqual([
      'plugin "core": "./catalog/missing" has no SKILL.md (renamed or removed?)',
    ]);
  });

  it('reports a dependency on a plugin the marketplace does not list', () => {
    writeFixture({ plugins: [{ name: 'sdlc', source: './', dependencies: ['core'] }] });
    expect(checkMarketplace(tempRoot)).toEqual([
      'plugin "sdlc": depends on "core", which isn\'t in this marketplace',
    ]);
  });

  it('reports a persona policy skill that core does not ship', () => {
    writeFixture({
      plugins: [{ name: 'core', source: './', skills: ['./catalog/security-baseline'] }],
      personas: [
        '| Persona  | Policy skills                    |',
        '|----------|----------------------------------|',
        '| personal | security-baseline, ux-personal   |',
      ].join('\n'),
    });
    expect(checkMarketplace(tempRoot)).toEqual([
      'personas.md names "ux-personal", but the core plugin doesn\'t ship it',
    ]);
  });
});

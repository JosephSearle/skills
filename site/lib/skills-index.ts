import type { SkillEntry, SkillsIndex } from './types';
import indexData from '../generated/skills-index.json';

const index = indexData as SkillsIndex;

export function getAllSkills(): SkillEntry[] {
  return index.skills;
}

export function getSkillBySlug(slug: string): SkillEntry | undefined {
  return index.skills.find((skill) => skill.slug === slug);
}

export function getReferenceBasename(referencePath: string): string {
  return referencePath.split('/').pop() ?? referencePath;
}

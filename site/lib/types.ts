export interface ReferenceEntry {
  title: string;
  path: string;
  sizeBytes: number;
}

export interface ArchiveEntry {
  path: string;
  sizeBytes: number;
}

export interface SkillEntry {
  slug: string;
  name: string;
  summary: string;
  description: string;
  body: string;
  references: ReferenceEntry[];
  hasScripts: boolean;
  hasEvals: boolean;
  archiveTree: ArchiveEntry[];
  downloadPath: string;
  downloadSizeBytes: number;
}

export interface SkillsIndex {
  generatedAt: string;
  skills: SkillEntry[];
}

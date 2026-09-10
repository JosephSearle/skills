import type { SkillEntry } from '@/lib/types';
import Link from 'next/link';
import { BadgeRow } from './BadgeRow';
import { DownloadButton } from './DownloadButton';

export function SkillCard({ skill }: { skill: SkillEntry }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-5 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h3 className="font-mono font-semibold">{skill.slug}</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{skill.summary}</p>
      </div>
      <BadgeRow skill={skill} />
      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <Link
          href={`/skills/${skill.slug}`}
          className="text-sm text-sky-600 hover:underline dark:text-sky-400"
        >
          Read skill
        </Link>
        <DownloadButton
          downloadPath={skill.downloadPath}
          fileName={`${skill.slug}.skill`}
          sizeBytes={skill.downloadSizeBytes}
        />
      </div>
    </div>
  );
}

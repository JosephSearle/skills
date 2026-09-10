import type { SkillEntry } from '@/lib/types';

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {label}
    </span>
  );
}

export function BadgeRow({ skill }: { skill: SkillEntry }) {
  const badges: string[] = [];
  if (skill.references.length > 0) badges.push('refs');
  if (skill.hasScripts) badges.push('scripts');
  if (skill.hasEvals) badges.push('evals');

  if (badges.length === 0) return null;

  return (
    <div className="flex gap-2">
      {badges.map((label) => (
        <Badge key={label} label={label} />
      ))}
    </div>
  );
}

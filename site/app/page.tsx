import { getAllSkills } from '@/lib/skills-index';
import { SkillCard } from '@/components/SkillCard';

export default function BrowsePage() {
  const skills = getAllSkills();

  return (
    <div className="flex flex-col gap-8">
      <div className="-mx-6 -mt-8 border-b border-slate-200 px-6 py-10 dark:border-slate-800">
        <h1 className="text-3xl font-extrabold">Every skill in the repo, in one place.</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">
          Browse what each skill does, read its full instructions, and download it as a
          single file you can drop into another project.
        </p>
        <div className="mt-4 flex gap-6 text-sm text-slate-500 dark:text-slate-400">
          <span>
            <strong className="text-slate-900 dark:text-slate-100">{skills.length}</strong> skills
          </span>
          <span>Alphabetical by folder</span>
          <span>Rebuilt on every deploy</span>
        </div>
      </div>

      {skills.length === 0 ? (
        <div className="rounded-lg border border-slate-200 p-12 text-center dark:border-slate-800">
          <p className="text-lg font-semibold">No skills yet</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            The build found no top-level folder containing a SKILL.md. Add one and redeploy —
            no code changes needed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <SkillCard key={skill.slug} skill={skill} />
          ))}
        </div>
      )}
    </div>
  );
}

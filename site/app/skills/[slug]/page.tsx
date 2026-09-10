import { ArchiveTree } from '@/components/ArchiveTree';
import { Breadcrumb } from '@/components/Breadcrumb';
import { DownloadButton } from '@/components/DownloadButton';
import { ReferenceList } from '@/components/ReferenceList';
import { UsingItElsewhere } from '@/components/UsingItElsewhere';
import { MarkdownBody } from '@/lib/markdown';
import { getAllSkills, getSkillBySlug } from '@/lib/skills-index';
import { notFound } from 'next/navigation';

export function generateStaticParams() {
  return getAllSkills().map((skill) => ({ slug: skill.slug }));
}

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const skill = getSkillBySlug(slug);
  if (!skill) notFound();

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'All skills', href: '/' }, { label: skill.slug }]} />

        <div>
          <h1 className="font-mono text-2xl font-bold">{skill.slug}</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">{skill.summary}</p>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Description — for Claude, not for you
          </p>
          <p className="mt-2 font-mono text-sm text-slate-600 dark:text-slate-400">
            {skill.description}
          </p>
        </div>

        <MarkdownBody source={skill.body} />

        <ReferenceList slug={skill.slug} references={skill.references} />
      </div>

      <aside className="flex flex-col gap-6">
        <DownloadButton
          downloadPath={skill.downloadPath}
          fileName={`${skill.slug}.skill`}
          sizeBytes={skill.downloadSizeBytes}
          variant="prominent"
        />
        <ArchiveTree slug={skill.slug} items={skill.archiveTree} />
        <UsingItElsewhere />
      </aside>
    </div>
  );
}

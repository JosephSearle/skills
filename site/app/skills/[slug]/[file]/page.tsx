import fs from 'node:fs';
import path from 'node:path';
import { Breadcrumb } from '@/components/Breadcrumb';
import { formatBytes } from '@/lib/format-bytes';
import { MarkdownBody } from '@/lib/markdown';
import { REPO_ROOT } from '@/lib/repo-root';
import { getAllSkills, getReferenceBasename, getSkillBySlug } from '@/lib/skills-index';
import { notFound } from 'next/navigation';

export function generateStaticParams() {
  return getAllSkills().flatMap((skill) =>
    skill.references.map((ref) => ({
      slug: skill.slug,
      file: getReferenceBasename(ref.path),
    })),
  );
}

export default async function ReferenceFilePage({
  params,
}: {
  params: Promise<{ slug: string; file: string }>;
}) {
  const { slug, file } = await params;
  const skill = getSkillBySlug(slug);
  if (!skill) notFound();

  const reference = skill.references.find((ref) => getReferenceBasename(ref.path) === file);
  if (!reference) notFound();

  const absolutePath = path.join(REPO_ROOT, skill.slug, reference.path);
  const content = fs.readFileSync(absolutePath, 'utf-8');

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={[
          { label: 'All skills', href: '/' },
          { label: skill.slug, href: `/skills/${skill.slug}` },
          { label: file },
        ]}
      />

      <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
        <div>
          <p className="font-mono text-sm text-slate-500 dark:text-slate-400">
            {reference.path} · {formatBytes(reference.sizeBytes)}
          </p>
        </div>
        <a
          href={`/skills/${skill.slug}`}
          className="text-sm text-sky-600 hover:underline dark:text-sky-400"
        >
          Back to skill
        </a>
      </div>

      <MarkdownBody source={content} />
    </div>
  );
}

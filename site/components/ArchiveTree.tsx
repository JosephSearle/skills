import type { ArchiveEntry } from '@/lib/types';
import { buildTreeLines } from '@/lib/build-tree-lines';

export function ArchiveTree({ slug, items }: { slug: string; items: ArchiveEntry[] }) {
  const lines = buildTreeLines(items);

  return (
    <div className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        What&rsquo;s in the archive
      </h2>
      <pre className="mt-2 overflow-x-auto font-mono text-xs leading-relaxed text-slate-700 dark:text-slate-300">
        {`${slug}/\n`}
        {lines.join('\n')}
      </pre>
    </div>
  );
}

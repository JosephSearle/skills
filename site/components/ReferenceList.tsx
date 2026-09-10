import Link from 'next/link';
import type { ReferenceEntry } from '@/lib/types';
import { formatBytes } from '@/lib/format-bytes';
import { getReferenceBasename } from '@/lib/skills-index';
import { FileIcon, ChevronRightIcon } from './Icons';

export function ReferenceList({ slug, references }: { slug: string; references: ReferenceEntry[] }) {
  if (references.length === 0) return null;

  return (
    <div>
      <h2 className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Reference files
      </h2>
      <ul className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {references.map((ref) => (
          <li key={ref.path}>
            <Link
              href={`/skills/${slug}/${getReferenceBasename(ref.path)}`}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span className="flex items-center gap-2 font-mono text-sky-600 dark:text-sky-400">
                <FileIcon className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                {ref.path}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-slate-500 dark:text-slate-400">
                {formatBytes(ref.sizeBytes)}
                <ChevronRightIcon className="h-4 w-4" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

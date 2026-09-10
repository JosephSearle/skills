import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
      <Link href="/" className="flex items-center gap-2 font-bold">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-slate-900 text-xs text-white dark:bg-sky-400 dark:text-slate-950">
          s
        </span>
        skills
      </Link>
      <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
        <span>JosephSearle/skills</span>
        <ThemeToggle />
      </div>
    </header>
  );
}

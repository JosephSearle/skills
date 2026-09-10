'use client';

import { useState } from 'react';
import { formatBytes } from '@/lib/format-bytes';
import { DownloadIcon } from './Icons';

export function DownloadButton({
  downloadPath,
  fileName,
  sizeBytes,
  variant = 'compact',
}: {
  downloadPath: string;
  fileName: string;
  sizeBytes: number;
  variant?: 'compact' | 'prominent';
}) {
  const [downloaded, setDownloaded] = useState(false);

  function handleClick() {
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }

  if (variant === 'prominent') {
    return (
      <div className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
        <a
          href={downloadPath}
          download
          onClick={handleClick}
          className={
            downloaded
              ? 'flex w-full items-center justify-center gap-2 rounded-md bg-sky-100 px-4 py-2 text-center font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300'
              : 'flex w-full items-center justify-center gap-2 rounded-md bg-sky-500 px-4 py-2 text-center font-medium text-white hover:bg-sky-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500'
          }
        >
          {downloaded ? (
            `Downloaded · ${formatBytes(sizeBytes)}`
          ) : (
            <>
              <DownloadIcon className="h-4 w-4" />
              Download .skill
            </>
          )}
        </a>
        <p className="mt-2 text-center font-mono text-xs text-slate-500 dark:text-slate-400">
          {fileName} <span className="ml-1">{formatBytes(sizeBytes)}</span>
        </p>
      </div>
    );
  }

  return (
    <a
      href={downloadPath}
      download
      onClick={handleClick}
      className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-slate-700 dark:hover:bg-slate-800"
    >
      {downloaded ? (
        `Downloaded · ${formatBytes(sizeBytes)}`
      ) : (
        <>
          <DownloadIcon className="h-3.5 w-3.5" />
          .skill
        </>
      )}
    </a>
  );
}

export function UsingItElsewhere() {
  const steps = [
    {
      id: 'download',
      content: (
        <>
          Download the <code className="font-mono text-sky-600 dark:text-sky-400">.skill</code> file
        </>
      ),
    },
    {
      id: 'rename',
      content: (
        <>
          Rename it to <code className="font-mono text-sky-600 dark:text-sky-400">.zip</code> and
          unzip
        </>
      ),
    },
    { id: 'drop', content: 'Drop the folder into your skills directory' },
  ];

  return (
    <div className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Using it elsewhere
      </h2>
      <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-slate-600 dark:text-slate-400">
        {steps.map((step) => (
          <li key={step.id}>{step.content}</li>
        ))}
      </ol>
    </div>
  );
}

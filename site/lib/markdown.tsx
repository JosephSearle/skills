import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

export function MarkdownBody({ source }: { source: string }) {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none prose-pre:bg-slate-900 prose-pre:text-slate-100">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {source}
      </ReactMarkdown>
    </div>
  );
}

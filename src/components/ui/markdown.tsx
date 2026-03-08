'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownProps {
  children: string;
  className?: string;
}

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn('prose prose-sm prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Make links clickable and open in new tab
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </a>
          ),
          // Style paragraphs
          p: ({ children }) => (
            <p className="mb-2 last:mb-0">{children}</p>
          ),
          // Style lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-2 last:mb-0 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-2 last:mb-0 space-y-1">{children}</ol>
          ),
          // Style code
          code: ({ children }) => (
            <code className="bg-zinc-800 px-1 py-0.5 rounded text-xs">{children}</code>
          ),
          // Style code blocks
          pre: ({ children }) => (
            <pre className="bg-zinc-800 p-2 rounded text-xs overflow-x-auto mb-2 last:mb-0">{children}</pre>
          ),
          // Style headings (scale down for card context)
          h1: ({ children }) => (
            <h1 className="text-sm font-semibold mb-1">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-semibold mb-1">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-semibold mb-1">{children}</h3>
          ),
          // Style blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-zinc-600 pl-2 italic text-zinc-400 mb-2 last:mb-0">
              {children}
            </blockquote>
          ),
          // Style tables (GFM)
          table: ({ children }) => (
            <div className="overflow-x-auto mb-2 last:mb-0">
              <table className="min-w-full border-collapse text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-zinc-700 bg-zinc-800/50">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-2 py-1 text-left font-semibold text-zinc-300">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-2 py-1 border-b border-zinc-800 text-zinc-400">
              {children}
            </td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

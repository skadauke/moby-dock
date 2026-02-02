'use client';

import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface MarkdownProps {
  children: string;
  className?: string;
}

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn('prose prose-sm prose-invert max-w-none', className)}>
      <ReactMarkdown
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
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

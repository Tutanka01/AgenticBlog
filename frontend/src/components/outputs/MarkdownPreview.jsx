import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownPreview({ content, className = '' }) {
  return (
    <div className={`markdown-view max-w-none ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-5 mb-2 text-[16px] font-bold tracking-[-0.4px]" style={{ color: '#E8E6E3' }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-4 mb-1.5 text-[14px] font-semibold" style={{ color: '#D4D4D8' }}>
              {children}
            </h2>
          ),
          p: ({ children }) => (
            <p className="mb-2.5 text-[12px] leading-[1.75]" style={{ color: '#A1A1AA' }}>
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong style={{ color: '#E8E6E3', fontWeight: 600 }}>{children}</strong>
          ),
          em: ({ children }) => (
            <em style={{ color: '#A78BFA', fontStyle: 'italic' }}>{children}</em>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className="my-3 border-l-2 pl-3 italic"
              style={{ borderColor: '#8B5CF6', color: '#71717A' }}
            >
              {children}
            </blockquote>
          ),
          ul: ({ children }) => (
            <ul className="mb-3 list-disc pl-5 text-[12px] leading-[1.7]" style={{ color: '#A1A1AA' }}>
              {children}
            </ul>
          ),
          li: ({ children }) => <li className="mb-1 marker:text-[#8B5CF6]">{children}</li>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" style={{ color: '#8B5CF6', textDecoration: 'none' }}>
              {children}
            </a>
          ),
          code: ({ inline, children }) => {
            if (inline) {
              return (
                <code
                  className="mono rounded px-1.5 py-[1px] text-[11px]"
                  style={{ backgroundColor: '#1C1C20', color: '#C4B5FD' }}
                >
                  {children}
                </code>
              );
            }

            return (
              <code
                className="mono block overflow-x-auto rounded-md border p-3 text-[11px]"
                style={{ backgroundColor: '#0A0A0C', borderColor: '#27272A', color: '#86EFAC' }}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  );
}

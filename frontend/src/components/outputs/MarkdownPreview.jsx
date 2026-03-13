import ReactMarkdown from 'react-markdown';

export default function MarkdownPreview({ content }) {
  return (
    <div className="markdown-view prose prose-invert max-w-none text-sm" style={{ color: 'var(--text-secondary)' }}>
      <ReactMarkdown>{content || ''}</ReactMarkdown>
    </div>
  );
}

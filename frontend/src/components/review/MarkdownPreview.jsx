import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Theme-aware renderer — styling lives in the .markdown-view CSS so it follows
// the active theme instead of hardcoding colours.
export default function MarkdownPreview({ content, className = '' }) {
  return (
    <div className={`markdown-view ${className}`.trim()} style={{ fontSize: 14 }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || ''}</ReactMarkdown>
    </div>
  );
}

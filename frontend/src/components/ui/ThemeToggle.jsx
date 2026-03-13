import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="flex h-7 w-7 items-center justify-center rounded-md border transition duration-150 ease-out"
      style={{
        borderColor: 'var(--bg-border)',
        backgroundColor: 'var(--bg-elevated)',
        color: 'var(--text-secondary)',
      }}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}

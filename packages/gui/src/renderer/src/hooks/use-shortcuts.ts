import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SECTIONS = ['/clusters', '/templates', '/running', '/settings'];

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * ⌘/Ctrl+1-4: sections · ⌘/Ctrl+K: palette · /: focus the view's search field
 */
export function useShortcuts(openPalette: () => void): void {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && !e.altKey && /^[1-4]$/.test(e.key)) {
        e.preventDefault();
        navigate(SECTIONS[Number(e.key) - 1]);
      } else if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openPalette();
      } else if (e.key === '/' && !mod && !isTyping(e.target)) {
        const field = document.querySelector<HTMLInputElement>('[data-search]');
        if (field) {
          e.preventDefault();
          field.focus();
          field.select();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, openPalette]);
}

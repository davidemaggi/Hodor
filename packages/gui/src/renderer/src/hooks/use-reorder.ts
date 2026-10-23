import { useState } from 'react';

/**
 * Drag & drop and keyboard (Alt+↑/↓) reordering for a list of keyed items.
 * `onMove(from, to)` receives indexes; the caller owns the list.
 */
export function useReorder(onMove: (from: number, to: number) => void, enabled = true) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const rowProps = (index: number) =>
    enabled
      ? {
          onDragOver: (e: React.DragEvent) => {
            if (dragging === null) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setOver(index);
          },
          onDrop: (e: React.DragEvent) => {
            if (dragging === null) return;
            e.preventDefault();
            if (dragging !== index) onMove(dragging, index);
            setDragging(null);
            setOver(null);
          },
          'data-drag-over':
            over === index && dragging !== null && dragging !== index
              ? dragging < index
                ? 'below'
                : 'above'
              : undefined,
          'data-dragging': dragging === index ? true : undefined,
        }
      : {};

  const handleProps = (index: number, count: number) =>
    enabled
      ? {
          draggable: true,
          onDragStart: (e: React.DragEvent) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(index));
            setDragging(index);
          },
          onDragEnd: () => {
            setDragging(null);
            setOver(null);
          },
          onKeyDown: (e: React.KeyboardEvent) => {
            if (!e.altKey) return;
            if (e.key === 'ArrowUp' && index > 0) {
              e.preventDefault();
              onMove(index, index - 1);
            } else if (e.key === 'ArrowDown' && index < count - 1) {
              e.preventDefault();
              onMove(index, index + 1);
            }
          },
        }
      : { disabled: true };

  return { rowProps, handleProps };
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

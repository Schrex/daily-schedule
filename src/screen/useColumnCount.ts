import { useEffect, useState } from 'react';

/** The narrowest a Job card reads well, in rem. */
const COLUMN_MIN_REM = 18.125;
const MOST_COLUMNS = 3;

/**
 * How many columns of Job cards fit across the board: as many cards of the
 * least width as fit beside each other, at most three, at least one. Watches
 * the board, so it follows the window and the browser's zoom.
 */
export function useColumnCount(board: HTMLElement | null): number {
  const [columns, setColumns] = useState(MOST_COLUMNS);

  useEffect(() => {
    if (!board) return;
    const fit = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const gap = parseFloat(getComputedStyle(board).columnGap) || 0;
      const count = Math.floor((board.clientWidth + gap) / (COLUMN_MIN_REM * rem + gap));
      setColumns(Math.min(MOST_COLUMNS, Math.max(1, count)));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(board);
    return () => observer.disconnect();
  }, [board]);

  return columns;
}

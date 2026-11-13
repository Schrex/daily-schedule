import { jumpDistance, type JumpStop } from './jumpStrip';

/** The gap left above a card jumped to, in pixels. */
const AIR = 8;

/**
 * Scrolls the card into view under the header (and under the Not Placed list
 * where that stays over the page). The page of cards is what scrolls; on a
 * window too short for that (a phone on its side) the whole window does.
 */
function jumpTo(strip: HTMLElement, key: string) {
  const page = strip.parentElement?.querySelector<HTMLElement>('.layout');
  const card = page?.querySelector<HTMLElement>(`[data-row="${CSS.escape(key)}"]`);
  if (!page || !card) return;
  const pageScrolls = page.scrollHeight > page.clientHeight && getComputedStyle(page).overflowY !== 'visible';
  const cover = page.querySelector<HTMLElement>('.not-placed');
  const covers = cover !== null && getComputedStyle(cover).position === 'sticky';
  const top = jumpDistance({
    cardTop: card.getBoundingClientRect().top,
    pageTop: pageScrolls ? page.getBoundingClientRect().top : 0,
    coveredTo: covers ? cover.getBoundingClientRect().bottom : 0,
    air: AIR,
  });
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  (pageScrolls ? page : window).scrollBy({ top, behavior });
}

/**
 * On a phone, a strip of names under the header: every open Job, then Shop,
 * Trucking and Off Work (`jumpStrip`). It is swiped sideways by itself; a tap
 * on a name jumps to that card and does nothing else, so with a name in hand
 * the card is still where they are put. Off a phone it is not shown.
 */
export function JumpBar({ stops }: { stops: JumpStop[] }) {
  return (
    <nav className="jump-strip" aria-label="Jump to a card">
      {stops.map((stop) => (
        <button
          key={stop.key}
          type="button"
          className="button jump-stop"
          onClick={(event) => jumpTo(event.currentTarget.parentElement!, stop.key)}
        >
          {stop.name}
        </button>
      ))}
    </nav>
  );
}

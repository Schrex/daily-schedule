/**
 * The one palette: every color of the Scheduler's screen, the settings page
 * and the picture sent to the crew. The picture reads `PALETTE` directly; the
 * pages get it as CSS custom properties (`applyPalette`), so the style sheets
 * name colors (`var(--alert)`) and never repeat a value.
 */

import type { Color } from './schedule-rules';

export const PALETTE = {
  ink: '#111111',
  paper: '#ffffff',
  /** The ruled lines of the schedule. */
  grid: '#1f1f1f',
  /** The JOB / TASKS / WHO header, and the main action buttons. */
  header: '#1f3864',
  headerHover: '#2f5597',
  /** The Standing Rows. */
  standing: '#f1f1f1',
  /** Quiet backgrounds: the hint bar, a hovered plain button. */
  wash: '#eef1f5',
  /** Where typing or a click would land. */
  highlight: '#fff3bf',
  /** The one alert red: Notes, Not Placed, a refused Send, UPDATED. */
  alert: '#c00000',
  alertWash: '#fff5f5',
  alertWashStrong: '#ffe3e3',
  /** The name being moved: a color no Crew Member has. */
  selected: '#7a00cc',
  /** The block the pointer would place them in. */
  target: '#e9d5ff',
  /** Send. */
  go: '#1e7b34',
  goDark: '#14532d',
  muted: '#555555',
  disabled: '#9a9a9a',
  rule: '#d0d0d0',
  /** The outline of a name cell. */
  nameBorder: 'rgba(0, 0, 0, 0.45)',
  /** Behind the Change date panel. */
  backdrop: 'rgba(0, 0, 0, 0.45)',
} as const;

/** The fill of a Crew Member's name, by their color. */
export const CREW_COLORS: Record<Color, string> = {
  grey: '#bfbfbf',
  blue: '#9dc3e6',
  orange: '#f4b183',
  yellow: '#ffe066',
  red: '#e03131',
};

/** The text on a name: white on red, ink on the lighter colors. */
export const crewInk = (color: Color): string => (color === 'red' ? PALETTE.paper : PALETTE.ink);

/**
 * Hands the palette to the style sheets: `--ink`, `--alert-wash`, ... and the
 * Crew Member colors as `--crew-grey`, `--crew-grey-ink`, ... Call once,
 * before the page is drawn.
 */
export function applyPalette(root: HTMLElement = document.documentElement): void {
  const dashed = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  for (const [name, value] of Object.entries(PALETTE)) {
    root.style.setProperty(`--${dashed(name)}`, value);
  }
  for (const [color, value] of Object.entries(CREW_COLORS)) {
    root.style.setProperty(`--crew-${color}`, value);
    root.style.setProperty(`--crew-${color}-ink`, crewInk(color as Color));
  }
}

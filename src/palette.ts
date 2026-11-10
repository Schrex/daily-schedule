/**
 * The one palette: every color of the Scheduler's screen, the settings page
 * and the picture sent to the crew. The picture reads `PALETTE` directly; the
 * pages get it as CSS custom properties (`applyPalette`), so the style sheets
 * name colors (`var(--alert)`) and never repeat a value.
 */

import type { Color } from './schedule-rules';

export const PALETTE = {
  ink: '#141922',
  paper: '#ffffff',
  /** Behind everything: the calm surface the white cards sit on. */
  canvas: '#f2f4f7',
  /** Hairlines: the rules between rows, the edge of a card. */
  line: '#e3e6ec',
  /** The edge of something to click or type in. */
  lineStrong: '#c9ced8',
  /** The Standing Rows. */
  standing: '#f6f7f9',
  /** Quiet backgrounds: a hovered plain button, the Tasks under the pointer. */
  wash: '#eceff4',
  /** The one alert red: Notes, Not Placed, a refused Send, UPDATED. */
  alert: '#c5221f',
  alertWash: '#fef4f3',
  alertWashStrong: '#fde3e0',
  alertLine: '#f0b4ae',
  /**
   * The one accent: the name being moved, where it would land, and the main
   * action. No Crew Member has it.
   */
  accent: '#4f46e5',
  accentHover: '#4038c7',
  accentWash: '#eef0fe',
  /** The block the pointer would place them in. */
  target: '#e4e7fd',
  /** A Send that worked. */
  goDark: '#12603d',
  goWash: '#e8f5ee',
  muted: '#566070',
  disabled: '#9aa1ad',
  /** Soft shadows: a resting card, and something lifted above the screen. */
  shadow: 'rgba(20, 25, 34, 0.07)',
  shadowStrong: 'rgba(20, 25, 34, 0.18)',
  /** The outline of a name. */
  nameBorder: 'rgba(20, 25, 34, 0.14)',
  /** Behind the Change date panel. */
  backdrop: 'rgba(20, 25, 34, 0.5)',
} as const;

/** The fill of a Crew Member's name, by their color. */
export const CREW_COLORS: Record<Color, string> = {
  grey: '#d3d7de',
  blue: '#aed0f8',
  orange: '#fcbf8b',
  yellow: '#fbe170',
  red: '#d63a3a',
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

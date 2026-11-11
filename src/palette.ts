/**
 * The one palette: every color of the Scheduler's screen, the settings page
 * and the picture sent to the crew. The picture reads `PALETTE` directly; the
 * pages get it as CSS custom properties (`applyPalette`), so the style sheets
 * name colors (`var(--alert)`) and never repeat a value.
 */

import type { Color } from './schedule-rules';

export const PALETTE = {
  ink: '#14181d',
  paper: '#ffffff',
  /** Behind everything: the calm grey the white cards sit on. */
  canvas: '#e9ecef',
  /** Hairlines: the edge of a card, the rules between rows. */
  line: '#d5dae0',
  /** The edge of something to click or type in. */
  lineStrong: '#9aa3ae',
  /** Quiet backgrounds: a hovered plain button, the count of people on a Job. */
  wash: '#e9ecef',
  /** Text that is read once found: the hint, the Send message. */
  inkSoft: '#3a424c',
  /** The one alert red: Notes, a refused Send, UPDATED. */
  alert: '#c5221f',
  alertWash: '#fef4f3',
  alertWashStrong: '#fde3e0',
  alertLine: '#f0b4ae',
  /**
   * The one accent, burnt orange: the main action, the name being moved,
   * where it would land, Not Placed and the Tasks. No Crew Member has it.
   */
  accent: '#c2410c',
  accentHover: '#9a3412',
  /** Text and edges in the accent's family: the Not Placed heading, the Tasks label. */
  accentDark: '#9a3412',
  accentWash: '#fff4ec',
  accentLine: '#f3c9a8',
  /** The block the pointer would place them in. */
  target: '#fff4ec',
  /** A Send that worked. */
  goDark: '#12603d',
  goWash: '#e8f5ee',
  muted: '#5b6470',
  disabled: '#9aa1ad',
  /** Soft shadows: a resting card, and something lifted above the screen. */
  shadow: 'rgba(20, 24, 29, 0.07)',
  shadowStrong: 'rgba(20, 24, 29, 0.2)',
  /** Behind the Change date panel. */
  backdrop: 'rgba(20, 24, 29, 0.5)',
} as const;

/** The fill of a Crew Member's name, by their color. */
export const CREW_COLORS: Record<Color, string> = {
  grey: '#1b2026',
  blue: '#cfe0f5',
  orange: '#f3b67c',
  yellow: '#f4dc7c',
  red: '#b8322a',
};

/** What a color is called where the Scheduler picks one: "grey" is drawn near-black. */
export const COLOR_NAMES: Record<Color, string> = {
  grey: 'Black',
  blue: 'Blue',
  orange: 'Orange',
  yellow: 'Yellow',
  red: 'Red',
};

/** The text on a name: white on the dark colors (black, red), ink on the lighter ones. */
export const crewInk = (color: Color): string =>
  color === 'red' || color === 'grey' ? PALETTE.paper : PALETTE.ink;

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

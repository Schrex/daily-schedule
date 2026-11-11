/**
 * The one palette: every color of the Scheduler's screen, the settings page
 * and the picture sent to the crew. The picture reads `PALETTE` directly; the
 * pages get it as CSS custom properties (`applyPalette`), so the style sheets
 * name colors (`var(--alert)`) and never repeat a value.
 */

import type { Color } from './schedule-rules';

export const PALETTE = {
  ink: '#1a1a1a',
  paper: '#ffffff',
  /** Behind everything: the warm off-white the white cards sit on. */
  canvas: '#f5f5f3',
  /** Hairlines: the edge of a card, the rules between rows. */
  line: '#e2e2de',
  /** The edge of something to click or type in. */
  lineStrong: '#bdbdb6',
  /** Quiet backgrounds: a hovered plain button. */
  wash: '#efefea',
  /** Text that is read once found: the hint, counts, the Send message. */
  inkSoft: '#55554f',
  /** The one alert red: Notes, a failed Send, UPDATED. */
  alert: '#c5221f',
  alertWash: '#fef4f3',
  alertWashStrong: '#fde3e0',
  alertLine: '#f0b4ae',
  /**
   * The one accent, Schreiber yellow: Send, the count of who is not placed,
   * and the gold of the name being moved and the cards it can go to. No Crew
   * Member has it.
   */
  accent: '#ffc800',
  accentHover: '#f0bb00',
  /** The text on the accent. */
  accentInk: '#1a1a1a',
  /** The accent as an edge or ring, dark enough to show on white. */
  accentStrong: '#c99700',
  /** The pale yellow of the Settings gear and a field being typed in. */
  accentWash: '#fff8dc',
  /**
   * The blue of a selected name, and of the cards it can be moved to: its
   * ring, a card's edge, and the wash of the card under the pointer.
   */
  select: '#3b7dd8',
  selectWash: '#eef4fc',
  /** The grey chip of a name; a Foreman's is ink. */
  chip: '#f1f1ee',
  /** A Person Task under a Foreman's name, on the ink chip. */
  chipInkSoft: '#d6d6d2',
  /** A Send that worked. */
  goDark: '#12603d',
  goWash: '#e8f5ee',
  muted: '#55554f',
  disabled: '#a3a39c',
  /** Soft shadows: a resting card, and something lifted above the screen. */
  shadow: 'rgba(0, 0, 0, 0.06)',
  shadowStrong: 'rgba(0, 0, 0, 0.2)',
  /** Behind the Change date panel. */
  backdrop: 'rgba(26, 26, 26, 0.5)',
} as const;

/**
 * The dot beside a Crew Member's name on the board and in the picture, by
 * their color: strong enough to tell apart on the grey chip.
 */
export const CREW_DOTS: Record<Color, string> = {
  grey: '#1a1a1a',
  blue: '#3b7dd8',
  orange: '#f26b00',
  yellow: '#f5b800',
  red: '#e02020',
};

/** The fill of a Crew Member's name on the settings page, by their color. */
export const CREW_COLORS: Record<Color, string> = {
  grey: '#1a1a1a',
  blue: '#dce9f8',
  orange: '#f7c59a',
  yellow: '#ffe27a',
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
    root.style.setProperty(`--dot-${color}`, CREW_DOTS[color as Color]);
  }
}

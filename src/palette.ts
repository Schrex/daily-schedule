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
  /** A Note on a Crew Member: dark text on a soft yellow. */
  noteWash: '#fff4d1',
  noteInk: '#3d2f00',
  /** The one alert red: a failed Send. */
  alert: '#c5221f',
  alertWash: '#fef4f3',
  alertLine: '#f0b4ae',
  /**
   * The one accent, Schreiber yellow: Send, Add task, the dashed edge of Not
   * placed yet and the focus ring. No Crew Member has it.
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
   * The blue of a selected name: its ring, the edge of its panel, and the
   * tint of the cards someone in hand can be moved to.
   */
  select: '#3b7dd8',
  selectWash: '#eef4fc',
  /** The ground of a quiet card in the crew picture (Off Work): between the canvas and white. */
  quietGround: '#fafaf8',
  /** The grey chip of a name; a Foreman's top line is ink. */
  chip: '#f1f1ee',
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
 * The role colours: the dot beside a Crew Member's name on the board and in
 * the picture. Operator blue, driver orange, laborer green (stored as
 * "yellow"), mechanic red, and gunmetal: a blue-grey kept clearly lighter
 * than the black dot. A Foreman's chip is dark with a white dot. Each is at
 * least 3:1 against the grey chip (WCAG AA for a non-text mark).
 */
export const CREW_DOTS: Record<Color, string> = {
  grey: '#1a1a1a',
  blue: '#3b7dd8',
  orange: '#d9620b',
  yellow: '#2f9e5b',
  red: '#e02020',
  gunmetal: '#5f6b75',
};

/** The fill of a Crew Member's name on the settings page, by their color. */
export const CREW_COLORS: Record<Color, string> = {
  grey: '#1a1a1a',
  blue: '#dce9f8',
  orange: '#f7c59a',
  yellow: '#cfeedd',
  red: '#b8322a',
  gunmetal: '#5f6b75',
};

/** What a color is called where the Scheduler picks one: "grey" is drawn near-black. */
export const COLOR_NAMES: Record<Color, string> = {
  grey: 'Black',
  blue: 'Blue',
  orange: 'Orange',
  yellow: 'Green',
  red: 'Red',
  gunmetal: 'Gunmetal',
};

/** The text on a name: white on the dark colors (black, red, gunmetal), ink on the lighter ones. */
export const crewInk = (color: Color): string =>
  color === 'red' || color === 'grey' || color === 'gunmetal' ? PALETTE.paper : PALETTE.ink;

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

import logoUrl from '../assets/schreiber-logo.png';
import { CREW_DOTS, PALETTE } from '../palette';
import { cardTitle, fullDate, sentStamp, type CrewView, type Roster, type ScheduleRow } from '../schedule-rules';
import { titlePlace } from './titleFit';

/**
 * Draws the crew view as a picture (a PNG) of the Daily Schedule, laid out as
 * the Scheduler's board is: the Schreiber logo at the top left with
 * "SCHEDULE FOR" and the date in the middle of that row, and a quiet line at
 * the right saying when it was made ("Sent Wed, Nov 11 · 6:42 PM"), the Notes
 * across the top, then the Job cards in two columns and Shop, Trucking and
 * Off Work in a third (with Jobs carrying on under them on a busy day). All
 * three columns are the same width, so every card is the same size.
 *
 * It is always the same square (`PICTURE_SIZE`): a busy day is drawn smaller
 * and a quiet one larger, so the whole day fits and fills it (`fit`). Text
 * too long for its place wraps, or is made a little smaller; it is never
 * squeezed.
 *
 * A card is its place's name with the Job number and how many at the right,
 * the day's Tasks ruled off from the names, then the names, one to a line: a
 * grey chip whose top line is a dot of the Crew Member's color and the name
 * (black for a Foreman), with their Person Tasks bulleted under it, and a Note
 * as a soft yellow strip at its foot. Off Work is a quieter card. It draws
 * exactly what it is given and nothing else: no buttons and no Not Placed
 * list. No rule is applied here.
 *
 * Drawn by hand on a canvas rather than photographed from the screen, so it
 * is the same picture whatever the Scheduler's window looks like, and drawn
 * at 4K (3840 pixels square) so it stays sharp when zoomed.
 *
 * `madeAt` is when it was made: the press of Send, or now for Preview. Sending
 * the same date again just gets a new time; there is no UPDATED marker.
 *
 * The roster, when given, gives a Job's number as the screen shows it;
 * without it (or for a Job no longer on it) the card shows the label alone.
 */
export async function renderCrewPicture(view: CrewView, madeAt: Date, roster?: Roster): Promise<Blob> {
  const canvas = await drawCrewPicture(view, madeAt, roster);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not draw the picture'))),
      'image/png',
    );
  });
}

/**
 * The same picture as `renderCrewPicture`, left on the canvas it is drawn on
 * (3840 pixels square) instead of made into a PNG. Making the PNG is most of
 * the time a picture takes, and only Send needs a file: Preview shows this.
 */
export async function drawCrewPicture(view: CrewView, madeAt: Date, roster?: Roster): Promise<HTMLCanvasElement> {
  const look = readLook();
  // The type is bundled with the page but only fetched when first used, and
  // the logo is a file of its own: make sure all of it is there before drawing.
  const [logo] = await Promise.all([
    loadImage(logoUrl),
    ...Object.values(look.type).map(({ font }) => document.fonts.load(font)),
  ]);

  const canvas = document.createElement('canvas');
  const measure = canvas.getContext('2d')!;
  const { scale, layout } = fit(view, roster, measure, look);

  // Sizing the canvas resets its context, so size first, then draw.
  canvas.width = PIXELS;
  canvas.height = PIXELS;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SHARPNESS * scale, SHARPNESS * scale);
  draw(ctx, view, sentStamp(madeAt), layout, look, logo);
  return canvas;
}

/** The picture's columns: the row keys in each, top to bottom, and how wide each is (a Job column is 1). */
export interface PictureColumns {
  columns: { share: number; keys: string[] }[];
}

/**
 * Which card goes in which column of the picture, worked out exactly as the
 * picture does (Jobs into the shorter of two columns, by their drawn heights;
 * Shop, Trucking and Off Work at the top of a third). For the office
 * TV, so its columns line up with the picture's.
 */
export async function crewPictureColumns(view: CrewView, roster?: Roster): Promise<PictureColumns> {
  const look = readLook();
  await Promise.all(Object.values(look.type).map(({ font }) => document.fonts.load(font)));
  const { layout } = fit(view, roster, document.createElement('canvas').getContext('2d')!, look);

  const lefts = [...new Set(layout.cards.map((card) => card.left))].sort((a, b) => a - b);
  const jobWidth = Math.max(...layout.cards.filter((card) => card.isJob).map((card) => card.width), 0);
  return {
    columns: lefts.map((left) => {
      const cards = layout.cards.filter((card) => card.left === left).sort((a, b) => a.top - b.top);
      return { share: jobWidth > 0 ? cards[0]!.width / jobWidth : 1, keys: cards.map((card) => card.key) };
    }),
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load the Schreiber logo'));
    image.src = src;
  });
}

// --- The look: the Scheduler's board, drawn by hand -------------------------
// Colors are the palette. The type families, the weights, the letter-spacings
// and the corners are the shared look's (the tokens in src/look.css), read off
// the page, so the picture and the screen cannot drift apart. Sizes are the
// picture's own: it is looked at on a phone, at under half its width, so they
// are large.

/** The picture's side in real pixels: 4K, so it stays sharp however far it is zoomed. */
const PIXELS = 3840;
const MARGIN = 30;

/**
 * One rem of the look, in the picture's pixels: what turns the look's corners
 * into the picture's, which are drawn at whole pixels.
 */
const REM = 26;

/** One kind of text: how it is set to be drawn or measured. */
interface Type {
  font: string;
  letterSpacing: string;
}

type Kind =
  | 'schedule'
  | 'date'
  | 'stamp'
  | 'job'
  | 'yard'
  | 'count'
  | 'number'
  | 'task'
  | 'yardTask'
  | 'name'
  | 'personTask'
  | 'note'
  | 'notesTitle'
  | 'dayNote';

/** The shared look as the picture uses it: its kinds of text and its corners. */
interface Look {
  type: Record<Kind, Type>;
  /** Corner radii, in the picture's pixels. */
  radius: { card: number; chip: number };
}

/** Reads the look's tokens off the page. Only the sizes of the text are the picture's own. */
function readLook(): Look {
  const tokens = getComputedStyle(document.documentElement);
  const token = (name: string): string => {
    const value = tokens.getPropertyValue(name).trim();
    if (!value) throw new Error(`The look has no ${name}: src/look.css is not on this page`);
    return value;
  };
  /** A token that is a number, or a number of em or rem. */
  const number = (name: string): number => parseFloat(token(name));

  const text = token('--font');
  const display = token('--font-display');
  const type = (family: string, weight: string, size: number, tracking?: string): Type => ({
    font: `${number(`--weight-${weight}`)} ${size}px ${family}`,
    letterSpacing: `${(tracking ? number(`--tracking-${tracking}`) : 0) * size}px`,
  });
  const corner = (name: string): number => Math.round(number(`--radius-${name}`) * REM);

  // As on the screen: Oswald capitals for the date and the places; Inter for
  // everything read, strong for the names.
  return {
    type: {
      schedule: type(text, 'bold', 19, 'label'),
      date: type(display, 'display', 48, 'heading'),
      stamp: type(text, 'medium', 19),
      job: type(display, 'display', 42, 'heading'),
      yard: type(display, 'display', 32, 'heading'),
      count: type(text, 'strong', 19),
      number: type(text, 'strong', 19, 'small'),
      // Tasks in regular weight so the names lead, as on the board; a Note medium.
      task: type(text, 'body', 24),
      yardTask: type(text, 'body', 22),
      // Names in medium: clear, without the weight of the places' capitals.
      name: type(text, 'medium', 27, 'name'),
      personTask: type(text, 'body', 22),
      note: type(text, 'medium', 22),
      notesTitle: type(display, 'display', 32, 'heading'),
      dayNote: type(text, 'body', 24),
    },
    radius: { card: corner('card'), chip: corner('chip') },
  };
}

/** The same type, at `factor` times its size. */
function scaled({ font, letterSpacing }: Type, factor: number): Type {
  return {
    font: font.replace(/([\d.]+)px/, (_, size: string) => `${Math.floor(parseFloat(size) * factor)}px`),
    letterSpacing: `${parseFloat(letterSpacing) * factor}px`,
  };
}

/** Sets the type to draw or measure with. */
function setType(ctx: CanvasRenderingContext2D, { font, letterSpacing }: Type) {
  ctx.font = font;
  ctx.letterSpacing = letterSpacing;
}

/**
 * The top row: the logo at the left, "SCHEDULE FOR" over the date in the
 * middle, and when it was made at the right, level with the date.
 */
const LOGO_HEIGHT = 84;
const HEADER_HEIGHT = LOGO_HEIGHT;
/** From the top of the row to the middle of "SCHEDULE FOR", and of the date a clear gap under it. */
const DATE_LABEL_MIDDLE = 12;
const DATE_MIDDLE = 58;
/** The date keeps at least this clear of the logo. */
const DATE_GAP = 30;
/** Under the top row, before the Notes or the cards. */
const HEADER_GAP = 22;

/**
 * The picture is always this square, whatever the day holds. Everything in it
 * is laid out at its usual size on a wider or narrower sheet, then drawn
 * smaller or larger to fill the square (`fit`): a busy day comes out smaller,
 * a quiet one larger, never past these bounds.
 */
const PICTURE_SIZE = 1210;
/** How many real pixels to each of the picture's own. */
const SHARPNESS = PIXELS / PICTURE_SIZE;
const SMALLEST = 0.3;
const LARGEST = 1.6;
const SCALE_STEP = 0.025;

/**
 * A card: one Job or Standing Row. Cards stand in columns, as on the board:
 * Jobs in two columns, and Shop, Trucking and Off Work at the top of a third
 * at the right (busy days carry Jobs on under them). The Notes for the day go
 * across the top, above all of them.
 */
const CARD_GAP = 20;
const COLUMN_GAP = 20;
const CARD_EDGE = 2;
const CARD_PAD = 20;
/** The columns of Jobs. */
const JOB_COLUMNS = 2;
/** The space between the parts of a card: the head, the Tasks, the names. */
const PART_GAP = 12;

/** The head: the place's name, with the Job number and count at the right. */
const JOB_LINE = 50;
const YARD_LINE = 42;
/** The space between a Job's name and its number. */
const NUMBER_GAP = 14;
/** The small line under a long title that holds its Job number. */
const NUMBER_LINE = 26;
/** Text made smaller to fit its room never goes under this much of its size. */
const MIN_FIT = 0.6;

/** The Tasks: plain lines, then a rule. */
const TASK_LINE = 33;
const YARD_TASK_LINE = 31;
const TASKS_RULE_GAP = 14;

/** Who: one name to a line, every one the width of the card. */
const NAME_HEIGHT = 58;
const NAME_GAP = 9;
const NAME_PAD_X = 16;
/** The color dot: nearly the name's size, as on the board (a 14px dot by a 15px name). */
const DOT = 25;
const DOT_GAP = 13;

/**
 * A Task lines up with the names under it: its bullet centred under their
 * color dots, its text where their names start.
 */
const BULLET = 9;
const BULLET_X = NAME_PAD_X + DOT / 2;
const TEXT_INDENT = NAME_PAD_X + DOT + DOT_GAP;
/** Person Tasks: bulleted lines under the name's line, in the same grey chip. From
 * the foot of the name's line to the first task: room under a black line, close under a grey one. */
const SUBS_PAD_TOP = 8;
const SUBS_PAD_TOP_GREY = -6;
const SUBS_PAD_BOTTOM = 12;
const SUB_LINE = 30;
/** A task's bullet: a small grey dot centred under the color dot. */
const SUB_BULLET = 7;
/** A Note: a soft yellow strip at the foot of the chip, its text lined up with the name. */
const NOTE_LINE = 30;
const NOTE_PAD_Y = 8;

/** The Notes: one white card, "NOTES" at its head and the notes one under the other. */
const DAY_NOTE_LINE = 34;
/** Between two notes, with a hairline in the middle. */
const DAY_NOTE_GAP = 18;

// --- Working out where everything goes --------------------------------------

/** One name in the column of names. `y` is from the top of the column. */
interface NameBox {
  name: string;
  /** The type of the name: the usual, or smaller for a name too long for its chip. */
  nameType: Type;
  dot: string;
  foreman: boolean;
  /** The Person Tasks, already broken into lines that fit the chip; `first` gets the bullet. */
  subLines: BulletLine[];
  /** The height of the chip, Person Tasks included; the Note hangs under it. */
  chipHeight: number;
  /** From the top of the chip to the first Person Task line. */
  subsTop: number;
  /** The Note's text in lines that fit under the name. */
  noteLines: string[];
  y: number;
  height: number;
}

interface CardLayout {
  /** The row's key, so others can tell which card is which. */
  key: string;
  isJob: boolean;
  /** Off Work: nobody there is working, so the card is quieter (grey ground, grey name). */
  quiet: boolean;
  /** Where the card is, from the top left of the sheet, and how wide. */
  left: number;
  top: number;
  width: number;
  height: number;
  titleLines: string[];
  /** The Job number is on a small line of its own under the title (a long title keeps one line). */
  numberBelow: boolean;
  /** The type of the title: the usual, or smaller for a name too long to fit beside its number. */
  titleType: Type;
  /** The Job number, drawn small after the name, if it has one. */
  number?: string;
  /** How many are on it, alone at the right. */
  countText: string;
  /** Each line of the Tasks (the first of each Task gets the bullet); empty when there are none. */
  taskLines: BulletLine[];
  /** From the top of the card. */
  namesTop: number;
  names: NameBox[];
}

/** One line of a Task: the first line of it, which has the bullet, or the rest. */
interface BulletLine {
  text: string;
  first: boolean;
}

interface NotesLayout {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Each note's lines, and its top from the top of the card. */
  notes: { top: number; lines: string[] }[];
}

interface Layout {
  cards: CardLayout[];
  notes: NotesLayout | null;
  /** The sheet everything is laid out on, before it is drawn into the square. */
  width: number;
  height: number;
}

/**
 * The scale that fills the square: the largest (up to `LARGEST`) at which the
 * whole day, laid out on a sheet of the square's size divided by it, is no
 * taller than the square. Nothing is ever cut off: `SMALLEST` is far below
 * any real day.
 */
function fit(
  view: CrewView,
  roster: Roster | undefined,
  ctx: CanvasRenderingContext2D,
  look: Look,
): { scale: number; layout: Layout } {
  for (let scale = LARGEST; scale > SMALLEST; scale -= SCALE_STEP) {
    const layout = layOut(view, roster, ctx, look, PICTURE_SIZE / scale);
    if (layout.height * scale <= PICTURE_SIZE) return { scale, layout };
  }
  return { scale: SMALLEST, layout: layOut(view, roster, ctx, look, PICTURE_SIZE / SMALLEST) };
}

/** Everything laid out on a sheet `sheetWidth` wide, at the usual sizes. */
function layOut(
  view: CrewView,
  roster: Roster | undefined,
  ctx: CanvasRenderingContext2D,
  look: Look,
  sheetWidth: number,
): Layout {
  const contentWidth = sheetWidth - 2 * MARGIN;
  let top = MARGIN + HEADER_HEIGHT + HEADER_GAP;

  // The Notes for the day across the top, so everyone reads them first.
  const notes = layOutNotes(view.dayNotes ?? [], ctx, look, contentWidth);
  if (notes) {
    notes.left = MARGIN;
    notes.top = top;
    top += notes.height + CARD_GAP;
  }

  // Two Job columns and one at the right for Shop, Trucking and Off Work,
  // which carries on with Jobs under them on a busy day. All the same width,
  // so a Job that lands in the right column is the same size as the others.
  const jobRows = view.rows.filter((row) => row.destination.kind === 'job');
  const yardRows = view.rows.filter((row) => row.destination.kind !== 'job');
  const jobColumns = Math.max(1, Math.min(JOB_COLUMNS, jobRows.length));
  const gaps = (jobColumns + (yardRows.length > 0 ? 1 : 0) - 1) * COLUMN_GAP;
  const shares = Array<number>(jobColumns + (yardRows.length > 0 ? 1 : 0)).fill(1);
  const unit = (contentWidth - gaps) / shares.reduce((sum, share) => sum + share, 0);
  let left = MARGIN;
  const columns = shares.map((share) => {
    const column = { left, width: share * unit, bottom: top };
    left += column.width + COLUMN_GAP;
    return column;
  });
  // One size for every name in the picture: the longest of the day sets it.
  const allNames = view.rows.flatMap((row) => row.who.map(({ crewMember }) => crewMember.name));
  const cards: CardLayout[] = [];
  const put = (row: ScheduleRow, column: { left: number; width: number; bottom: number }) => {
    const card = layOutCard(row, roster, ctx, look, column.width, allNames);
    card.left = column.left;
    card.top = column.bottom;
    column.bottom += card.height + CARD_GAP;
    cards.push(card);
  };
  for (const row of yardRows) put(row, columns.at(-1)!);
  for (const row of jobRows) {
    const shortest = columns.reduce((best, column) => (column.bottom < best.bottom ? column : best));
    put(row, shortest);
  }
  const height = Math.max(...columns.map((column) => column.bottom)) - CARD_GAP + MARGIN;
  return { cards, notes, width: sheetWidth, height };
}

/** One card, `width` wide, at the top left until it is placed. */
function layOutCard(
  row: ScheduleRow,
  roster: Roster | undefined,
  ctx: CanvasRenderingContext2D,
  look: Look,
  width: number,
  /** Every name in the picture, so all names are one size. */
  allNames: readonly string[],
): CardLayout {
  const inner = width - 2 * CARD_PAD;
  const isJob = row.destination.kind === 'job';
  const { name, number } = roster ? cardTitle(roster, row) : { name: row.label, number: undefined };
  const countText = `${row.who.length}`;
  setType(ctx, look.type.count);
  const countWidth = Math.ceil(ctx.measureText(countText).width);
  // Room for the Job number after the name, so it never runs into the count.
  setType(ctx, look.type.number);
  const numberWidth = number ? Math.ceil(ctx.measureText(number).width) + NUMBER_GAP : 0;

  // A title too long for the room beside the number and count is made smaller
  // to keep it on one line (BISHOP KEARNEY, COBBLESTONE alike); if even that is
  // not enough, the number goes on a small line under it and the title has the
  // room to itself. Only a name too long for that wraps (titlePlace).
  const beside = Math.max(inner / 2, inner - countWidth - numberWidth - 16);
  const alone = inner - countWidth - 16;
  const title = name.toUpperCase();
  let titleType = isJob ? look.type.job : look.type.yard;
  setType(ctx, titleType);
  const place = titlePlace({
    title: ctx.measureText(title).width,
    widestWord: Math.max(...title.split(/\s+/).map((word) => ctx.measureText(word).width)),
    beside,
    alone: number ? alone : beside,
    floor: MIN_FIT,
    hasNumber: number !== undefined,
  });
  if (place.scale < 1) {
    titleType = scaled(titleType, place.scale);
    setType(ctx, titleType);
  }
  const titleLines = place.oneLine ? [title] : wrap(ctx, title, beside);
  const headHeight = titleLines.length * (isJob ? JOB_LINE : YARD_LINE) + (place.numberBelow ? NUMBER_LINE : 0);

  setType(ctx, isJob ? look.type.task : look.type.yardTask);
  const taskLines = row.tasks.flatMap((task) => bulletLines(ctx, task, inner - TEXT_INDENT));
  const tasksHeight =
    taskLines.length > 0
      ? taskLines.length * (isJob ? TASK_LINE : YARD_TASK_LINE) + TASKS_RULE_GAP + PART_GAP
      : 0;

  const namesTop = CARD_PAD + headHeight + PART_GAP + tasksHeight;
  const { names, height: namesHeight } = stackNames(ctx, row, look, inner, allNames);

  return {
    key: row.key,
    isJob,
    quiet: row.destination.kind === 'standing-row' && row.destination.standingRow === 'off-work',
    left: 0,
    top: 0,
    width,
    height: namesTop + namesHeight + CARD_PAD,
    titleLines,
    numberBelow: place.numberBelow,
    titleType,
    ...(number ? { number } : {}),
    countText,
    taskLines,
    namesTop,
    names,
  };
}

/** Names one under the other, each with its Person Tasks in its chip and its Note under it. */
function stackNames(
  ctx: CanvasRenderingContext2D,
  row: ScheduleRow,
  look: Look,
  inner: number,
  /** Every name in the picture: one size for all of them, set by the longest. */
  allNames: readonly string[],
) {
  const names: NameBox[] = [];
  const textWidth = inner - 2 * NAME_PAD_X - DOT - DOT_GAP;
  // One size for every name in the picture: a name too long for its line makes
  // them all a little smaller together, so no card's names look smaller than another's.
  setType(ctx, look.type.name);
  const widest = allNames
    .reduce((longest, name) => (ctx.measureText(name).width > ctx.measureText(longest).width ? name : longest), '');
  const nameType = fitType(ctx, look.type.name, widest, textWidth);
  let y = 0;

  for (const { crewMember, note, personTasks = [] } of row.who) {
    setType(ctx, look.type.personTask);
    const subLines = personTasks.flatMap((task) => bulletLines(ctx, task, textWidth));
    const subsTop = NAME_HEIGHT + (crewMember.foreman ? SUBS_PAD_TOP : SUBS_PAD_TOP_GREY);
    const chipHeight =
      subLines.length > 0 ? subsTop + subLines.length * SUB_LINE + SUBS_PAD_BOTTOM : NAME_HEIGHT;
    setType(ctx, look.type.note);
    const noteLines = note ? wrap(ctx, note, textWidth) : [];
    const height = chipHeight + (noteLines.length > 0 ? 2 * NOTE_PAD_Y + noteLines.length * NOTE_LINE : 0);
    names.push({
      name: crewMember.name,
      nameType,
      dot: CREW_DOTS[crewMember.color],
      foreman: crewMember.foreman,
      subLines,
      chipHeight,
      subsTop,
      noteLines,
      y,
      height,
    });
    y += height + NAME_GAP;
  }

  return { names, height: Math.max(0, y - NAME_GAP) };
}

/** The Notes for the day card, `width` wide; null when there are none. */
function layOutNotes(
  dayNotes: string[],
  ctx: CanvasRenderingContext2D,
  look: Look,
  width: number,
): NotesLayout | null {
  if (dayNotes.length === 0) return null;
  setType(ctx, look.type.dayNote);
  let y = CARD_PAD + YARD_LINE + PART_GAP;
  const notes = dayNotes.map((note, index) => {
    if (index > 0) y += DAY_NOTE_GAP;
    const lines = wrap(ctx, note, width - 2 * CARD_PAD);
    const laid = { top: y, lines };
    y += lines.length * DAY_NOTE_LINE;
    return laid;
  });
  return { left: 0, top: 0, width, height: y + CARD_PAD, notes };
}

/** A Task's lines: the first gets the bullet; the rest line up with its text. */
const bulletLines = (ctx: CanvasRenderingContext2D, text: string, width: number): BulletLine[] =>
  wrap(ctx, text, width).map((line, index) => ({ text: line, first: index === 0 }));

/**
 * Breaks text into lines no wider than `width`, at spaces. A word wider than
 * a whole line (a part number, a link) is broken where it must be.
 */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const fits = (candidate: string) => ctx.measureText(candidate).width <= width;
  const pieces = text
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => {
      if (fits(word)) return [word];
      const parts: string[] = [];
      let part = '';
      for (const letter of word) {
        if (part && !fits(part + letter)) {
          parts.push(part);
          part = letter;
        } else {
          part += letter;
        }
      }
      return part ? [...parts, part] : parts;
    });

  const lines: string[] = [];
  let line = '';
  for (const piece of pieces) {
    const longer = line ? `${line} ${piece}` : piece;
    if (line && !fits(longer)) {
      lines.push(line);
      line = piece;
    } else {
      line = longer;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The type at which `text` fits in `width`: as it is, or smaller (never under `MIN_FIT`). */
function fitType(ctx: CanvasRenderingContext2D, type: Type, text: string, width: number): Type {
  setType(ctx, type);
  const needed = ctx.measureText(text).width;
  return needed <= width ? type : scaled(type, Math.max(MIN_FIT, width / needed));
}

// --- Drawing ----------------------------------------------------------------

function draw(
  ctx: CanvasRenderingContext2D,
  view: CrewView,
  stamp: string,
  layout: Layout,
  look: Look,
  logo: HTMLImageElement,
) {
  // The board's warm off-white over the whole square, with the white cards on it.
  ctx.fillStyle = PALETTE.canvas;
  ctx.fillRect(0, 0, layout.width, layout.width);
  ctx.textBaseline = 'middle';
  const contentWidth = layout.width - 2 * MARGIN;

  const logoWidth = (logo.naturalWidth / logo.naturalHeight) * LOGO_HEIGHT;
  ctx.drawImage(logo, MARGIN, MARGIN, logoWidth, LOGO_HEIGHT);

  // In the middle of the top row, clear of the logo: "SCHEDULE FOR" small,
  // and a clear gap under it the day and date (no year).
  const middle = MARGIN + contentWidth / 2;
  const dateWidth = contentWidth - 2 * (logoWidth + DATE_GAP);
  const [weekday, monthDay] = fullDate(view.date).split(', ');
  const date = `${weekday}, ${monthDay}`.toUpperCase();
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.muted;
  setType(ctx, fitType(ctx, look.type.schedule, 'SCHEDULE FOR', dateWidth));
  ctx.fillText('SCHEDULE FOR', middle, MARGIN + DATE_LABEL_MIDDLE);
  ctx.fillStyle = PALETTE.ink;
  setType(ctx, fitType(ctx, look.type.date, date, dateWidth));
  ctx.fillText(date, middle, MARGIN + DATE_MIDDLE);
  ctx.textAlign = 'left';

  // At the right, as wide as the logo at most: when it was made, quiet and
  // level with the date, so the row stays balanced.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.muted;
  setType(ctx, fitType(ctx, look.type.stamp, stamp, logoWidth));
  ctx.fillText(stamp, MARGIN + contentWidth, MARGIN + DATE_MIDDLE);
  ctx.textAlign = 'left';

  if (layout.notes) drawNotes(ctx, layout.notes, look);
  for (const card of layout.cards) drawCard(ctx, card, look);
}

/** A card's ground with a fine edge drawn wholly inside it. */
function drawCardGround(
  ctx: CanvasRenderingContext2D,
  box: { left: number; top: number; width: number; height: number },
  look: Look,
  ground: string = PALETTE.paper,
) {
  ctx.beginPath();
  ctx.roundRect(box.left, box.top, box.width, box.height, look.radius.card);
  ctx.fillStyle = ground;
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(
    box.left + CARD_EDGE / 2,
    box.top + CARD_EDGE / 2,
    box.width - CARD_EDGE,
    box.height - CARD_EDGE,
    look.radius.card,
  );
  ctx.strokeStyle = PALETTE.line;
  ctx.lineWidth = CARD_EDGE;
  ctx.stroke();
}

function drawCard(ctx: CanvasRenderingContext2D, card: CardLayout, look: Look) {
  const { top, isJob } = card;
  const inner = card.left + CARD_PAD;
  const innerWidth = card.width - 2 * CARD_PAD;
  drawCardGround(ctx, card, look, card.quiet ? PALETTE.quietGround : PALETTE.paper);

  // The name in capitals with the Job number small after it, and the count at the right.
  const headTop = top + CARD_PAD;
  const line = isJob ? JOB_LINE : YARD_LINE;
  ctx.fillStyle = card.quiet ? PALETTE.muted : PALETTE.ink;
  setType(ctx, card.titleType);
  card.titleLines.forEach((title, index) => ctx.fillText(title, inner, headTop + (index + 0.5) * line + 2));
  const titleEnd = inner + ctx.measureText(card.titleLines.at(-1) ?? '').width;
  ctx.fillStyle = PALETTE.muted;
  setType(ctx, look.type.count);
  const countWidth = ctx.measureText(card.countText).width;
  if (card.number && card.numberBelow) {
    // Under a long title, on a small line of its own, where the title starts.
    setType(ctx, fitType(ctx, look.type.number, card.number, innerWidth));
    ctx.fillText(card.number, inner, headTop + line + NUMBER_LINE / 2 - 2);
    setType(ctx, look.type.count);
  } else if (card.number) {
    const lastMiddle = headTop + (card.titleLines.length - 0.5) * line + 4;
    const numberRoom = inner + innerWidth - countWidth - 12 - (titleEnd + NUMBER_GAP);
    setType(ctx, fitType(ctx, look.type.number, card.number, Math.max(0, numberRoom)));
    ctx.fillText(card.number, titleEnd + NUMBER_GAP, lastMiddle);
    setType(ctx, look.type.count);
  }
  ctx.textAlign = 'right';
  ctx.fillText(card.countText, inner + innerWidth, headTop + line / 2 + 4);
  ctx.textAlign = 'left';

  // The Tasks: plain lines, then a rule above the names.
  if (card.taskLines.length > 0) {
    const taskLine = isJob ? TASK_LINE : YARD_TASK_LINE;
    const tasksTop = headTop + card.titleLines.length * line + (card.numberBelow ? NUMBER_LINE : 0) + PART_GAP;
    setType(ctx, isJob ? look.type.task : look.type.yardTask);
    card.taskLines.forEach((task, index) =>
      drawBulletLine(ctx, task, inner, tasksTop + (index + 0.5) * taskLine + 1),
    );
    ctx.fillStyle = PALETTE.line;
    ctx.fillRect(inner, tasksTop + card.taskLines.length * taskLine + TASKS_RULE_GAP - CARD_EDGE, innerWidth, CARD_EDGE);
  }

  for (const box of card.names) drawName(ctx, box, inner, innerWidth, top + card.namesTop + box.y, look);
}

function drawName(ctx: CanvasRenderingContext2D, box: NameBox, x: number, width: number, y: number, look: Look) {
  const r = look.radius.chip;
  const hasNote = box.noteLines.length > 0;
  const hasSubs = box.subLines.length > 0;

  // The chip, grey; square at the foot when the Note hangs under it.
  ctx.fillStyle = PALETTE.chip;
  ctx.beginPath();
  ctx.roundRect(x, y, width, box.chipHeight, hasNote ? [r, r, 0, 0] : r);
  ctx.fill();

  // A Foreman's line is black.
  if (box.foreman) {
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.roundRect(x, y, width, NAME_HEIGHT, hasSubs || hasNote ? [r, r, 0, 0] : r);
    ctx.fill();
  }

  const middle = y + NAME_HEIGHT / 2 + 1;
  const textX = x + NAME_PAD_X + DOT + DOT_GAP;

  // The dot of their color (white on a Foreman's black).
  ctx.fillStyle = box.foreman ? PALETTE.paper : box.dot;
  ctx.beginPath();
  ctx.arc(x + NAME_PAD_X + DOT / 2, middle, DOT / 2, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = box.foreman ? PALETTE.paper : PALETTE.ink;
  setType(ctx, box.nameType);
  ctx.fillText(box.name, textX, middle);

  // Their Person Tasks: lines starting where the name starts, each with a
  // small grey bullet centred under the color dot.
  setType(ctx, look.type.personTask);
  box.subLines.forEach((line, index) => {
    const lineMiddle = y + box.subsTop + (index + 0.5) * SUB_LINE;
    if (line.first) {
      ctx.fillStyle = PALETTE.muted;
      ctx.beginPath();
      ctx.arc(x + NAME_PAD_X + DOT / 2, lineMiddle, SUB_BULLET / 2, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText(line.text, textX, lineMiddle + 1);
  });

  // The Note: a soft yellow strip at the foot, its text lined up with the name.
  if (hasNote) {
    const top = y + box.chipHeight;
    ctx.fillStyle = PALETTE.noteWash;
    ctx.beginPath();
    ctx.roundRect(x, top, width, box.height - box.chipHeight, [0, 0, r, r]);
    ctx.fill();
    ctx.fillStyle = PALETTE.noteInk;
    setType(ctx, look.type.note);
    box.noteLines.forEach((line, index) =>
      ctx.fillText(line, textX, top + NOTE_PAD_Y + (index + 0.5) * NOTE_LINE + 1),
    );
  }
}

/** One line of a Task, centred on `middle`: a bullet before the first line of each. */
function drawBulletLine(ctx: CanvasRenderingContext2D, line: BulletLine, x: number, middle: number) {
  if (line.first) {
    ctx.fillStyle = PALETTE.muted;
    ctx.beginPath();
    ctx.arc(x + BULLET_X, middle, BULLET / 2, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText(line.text, x + TEXT_INDENT, middle);
}

/**
 * The Notes, across the top: one white card, "NOTES" at its head like any
 * card's name, then the notes one under the other, a hairline between two of
 * them. No bullets.
 */
function drawNotes(ctx: CanvasRenderingContext2D, layout: NotesLayout, look: Look) {
  drawCardGround(ctx, layout, look);
  const inner = layout.left + CARD_PAD;
  ctx.fillStyle = PALETTE.ink;
  setType(ctx, look.type.notesTitle);
  ctx.fillText('NOTES', inner, layout.top + CARD_PAD + YARD_LINE / 2 + 2);

  const innerWidth = layout.width - 2 * CARD_PAD;
  layout.notes.forEach((note, index) => {
    const noteTop = layout.top + note.top;
    if (index > 0) {
      ctx.fillStyle = PALETTE.line;
      ctx.fillRect(inner, noteTop - DAY_NOTE_GAP / 2 - CARD_EDGE / 2, innerWidth, CARD_EDGE);
    }
    ctx.fillStyle = PALETTE.ink;
    setType(ctx, look.type.dayNote);
    note.lines.forEach((line, at) => ctx.fillText(line, inner, noteTop + (at + 0.5) * DAY_NOTE_LINE + 1));
  });
}

import logoUrl from '../assets/schreiber-logo.png';
import { CREW_DOTS, PALETTE } from '../palette';
import { cardTitle, fullDate, type CrewView, type Roster, type ScheduleRow } from '../schedule-rules';

/**
 * Draws the crew view as a picture (a PNG) of the Daily Schedule, made to be
 * read on a phone: the Schreiber logo and the date at the top, then the
 * cards of the Scheduler's board one under the other, in the same clean look.
 * A card is its place's name with the Job number and how many at the right,
 * the day's Tasks as plain lines ruled off from the names, then the names,
 * one to a line: a grey chip with a dot of the Crew Member's color (a
 * Foreman's chip is black), with their Person Tasks smaller under the name.
 * A Note hangs under its name in red. The Notes for the day, if any, are a
 * last card. It draws exactly what it is given and nothing else: no buttons
 * and no Not Placed list. No rule is applied here.
 *
 * Drawn by hand on a canvas rather than photographed from the screen, so it
 * is the same picture whatever the Scheduler's window looks like. It is
 * narrow with large text, to be readable in Slack on a phone, and drawn at
 * twice its size so it stays sharp.
 *
 * The roster, when given, gives a Job's number as the screen shows it;
 * without it (or for a Job no longer on it) the card shows the label alone.
 */
export async function renderCrewPicture(view: CrewView, roster?: Roster): Promise<Blob> {
  const look = readLook();
  // The type is bundled with the page but only fetched when first used, and
  // the logo is a file of its own: make sure all of it is there before drawing.
  const [logo] = await Promise.all([
    loadImage(logoUrl),
    ...Object.values(look.type).map(({ font }) => document.fonts.load(font)),
  ]);

  const canvas = document.createElement('canvas');
  const measure = canvas.getContext('2d')!;
  const layout = layOut(view, roster, measure, look);

  // Sizing the canvas resets its context, so size first, then draw.
  canvas.width = WIDTH * SHARPNESS;
  canvas.height = layout.height * SHARPNESS;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SHARPNESS, SHARPNESS);
  draw(ctx, view, layout, look, logo);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not draw the picture'))),
      'image/png',
    );
  });
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

const WIDTH = 780;
const SHARPNESS = 2;
const MARGIN = 28;

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
  | 'date'
  | 'updated'
  | 'updatedNote'
  | 'job'
  | 'yard'
  | 'count'
  | 'task'
  | 'yardTask'
  | 'name'
  | 'personTask'
  | 'note'
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
      date: type(display, 'display', 52, 'heading'),
      updated: type(display, 'display', 38, 'button'),
      updatedNote: type(text, 'strong', 24),
      job: type(display, 'display', 44, 'heading'),
      yard: type(display, 'display', 36, 'heading'),
      count: type(text, 'strong', 22),
      task: type(text, 'body', 27),
      yardTask: type(text, 'body', 24),
      name: type(text, 'strong', 28, 'name'),
      personTask: type(text, 'body', 23),
      note: type(text, 'strong', 24),
      dayNote: type(text, 'body', 27),
    },
    radius: { card: corner('card'), chip: corner('chip') },
  };
}

/** Sets the type to draw or measure with. */
function setType(ctx: CanvasRenderingContext2D, { font, letterSpacing }: Type) {
  ctx.font = font;
  ctx.letterSpacing = letterSpacing;
}

/** The logo, as tall as this, left-aligned at the top. */
const LOGO_HEIGHT = 96;
const LOGO_GAP = 14;
const UPDATED_HEIGHT = 72;
const UPDATED_GAP = 16;
const UPDATED_PAD_X = 22;
const DATE_HEIGHT = 84;

/** A card: one Job or Standing Row, or the Notes for the day. */
const CARD_X = MARGIN;
const CARD_WIDTH = WIDTH - 2 * MARGIN;
const CARD_GAP = 18;
const CARD_EDGE = 2;
const CARD_PAD = 26;
const CARD_INNER_X = CARD_X + CARD_PAD;
const CARD_INNER_WIDTH = CARD_WIDTH - 2 * CARD_PAD;
/** The space between the parts of a card: the head, the Tasks, the names. */
const PART_GAP = 14;

/** The head: the place's name, with the Job number and count at the right. */
const JOB_LINE = 52;
const YARD_LINE = 44;
/** The space between a Job's name and its number. */
const NUMBER_GAP = 14;

/** The Tasks: plain lines, then a rule. */
const TASK_LINE = 38;
const YARD_TASK_LINE = 34;
const TASKS_RULE_GAP = 14;
/** The small round bullet before each Task and Day Note, and the space after it. */
const BULLET = 9;
const BULLET_GAP = 16;
const TEXT_INDENT = BULLET + BULLET_GAP;

/** Who: one name to a line, every one the width of the card. */
const NAME_HEIGHT = 70;
const NAME_GAP = 10;
const NAME_PAD_X = 20;
const DOT = 22;
const DOT_GAP = 16;
/** A name with Person Tasks: the name on a shorter line, then one line each. */
const SUBS_PAD_Y = 12;
const SUBS_NAME_LINE = 38;
const SUB_LINE = 30;
const NOTE_LINE = 32;
const NOTE_PAD_TOP = 6;
const NOTE_PAD_BOTTOM = 12;

/** The Notes for the day: one under the other, ruled apart. */
const DAY_NOTE_LINE = 40;
const DAY_NOTE_GAP = 12;

// --- Working out where everything goes --------------------------------------

/** One name in the column of names. `y` is from the top of the column. */
interface NameBox {
  name: string;
  dot: string;
  foreman: boolean;
  /** The Person Tasks, already broken into lines that fit the chip. */
  subLines: string[];
  /** The height of the chip, Person Tasks included; the Note hangs under it. */
  chipHeight: number;
  noteLines: string[];
  y: number;
  height: number;
}

interface CardLayout {
  isJob: boolean;
  top: number;
  height: number;
  titleLines: string[];
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

/** One line of a Task or Day Note: the first line of it, which has the bullet, or the rest. */
interface BulletLine {
  text: string;
  first: boolean;
}

interface NotesLayout {
  top: number;
  height: number;
  /** Each note's lines, and its top from the top of the card. */
  notes: { top: number; lines: BulletLine[] }[];
}

interface Layout {
  dateTop: number;
  cards: CardLayout[];
  notes: NotesLayout | null;
  height: number;
}

function layOut(
  view: CrewView,
  roster: Roster | undefined,
  ctx: CanvasRenderingContext2D,
  look: Look,
): Layout {
  const dateTop =
    MARGIN + LOGO_HEIGHT + LOGO_GAP + (view.updated ? UPDATED_HEIGHT + UPDATED_GAP : 0);

  let top = dateTop + DATE_HEIGHT;
  const cards = view.rows.map((row): CardLayout => {
    const isJob = row.destination.kind === 'job';
    const { name, number } = roster ? cardTitle(roster, row) : { name: row.label, number: undefined };
    const countText = `${row.who.length}`;
    setType(ctx, look.type.count);
    const countWidth = Math.ceil(ctx.measureText(countText).width);
    // Room for the Job number after the name, so it never runs into the count.
    const numberWidth = number ? Math.ceil(ctx.measureText(number).width) + NUMBER_GAP : 0;

    setType(ctx, isJob ? look.type.job : look.type.yard);
    const titleLines = wrap(ctx, name.toUpperCase(), CARD_INNER_WIDTH - countWidth - numberWidth - 16);
    const headHeight = titleLines.length * (isJob ? JOB_LINE : YARD_LINE);

    setType(ctx, isJob ? look.type.task : look.type.yardTask);
    const taskLines = row.tasks.flatMap((task) =>
      wrap(ctx, task, CARD_INNER_WIDTH - TEXT_INDENT).map((text, index) => ({ text, first: index === 0 })),
    );
    const tasksHeight =
      taskLines.length > 0
        ? taskLines.length * (isJob ? TASK_LINE : YARD_TASK_LINE) + TASKS_RULE_GAP + PART_GAP
        : 0;

    const namesTop = CARD_PAD + headHeight + PART_GAP + tasksHeight;
    const { names, height: namesHeight } = stackNames(ctx, row, look);

    const height = namesTop + namesHeight + CARD_PAD;
    const card: CardLayout = {
      isJob,
      top,
      height,
      titleLines,
      ...(number ? { number } : {}),
      countText,
      taskLines,
      namesTop,
      names,
    };
    top += height + CARD_GAP;
    return card;
  });

  const notes = layOutNotes(view.dayNotes ?? [], ctx, look, top);
  if (notes) top += notes.height + CARD_GAP;

  return { dateTop, cards, notes, height: top - CARD_GAP + MARGIN };
}

/** Names one under the other, each with its Person Tasks in its chip and its Note under it. */
function stackNames(ctx: CanvasRenderingContext2D, row: ScheduleRow, look: Look) {
  const names: NameBox[] = [];
  const textWidth = CARD_INNER_WIDTH - 2 * NAME_PAD_X - DOT - DOT_GAP;
  let y = 0;

  for (const { crewMember, note, personTasks = [] } of row.who) {
    setType(ctx, look.type.personTask);
    const subLines = personTasks.flatMap((task) => wrap(ctx, task, textWidth));
    const chipHeight =
      subLines.length > 0
        ? 2 * SUBS_PAD_Y + SUBS_NAME_LINE + subLines.length * SUB_LINE
        : NAME_HEIGHT;
    setType(ctx, look.type.note);
    const noteLines = note ? wrap(ctx, note, CARD_INNER_WIDTH - 2 * NAME_PAD_X) : [];
    const height =
      chipHeight +
      (noteLines.length > 0 ? NOTE_PAD_TOP + noteLines.length * NOTE_LINE + NOTE_PAD_BOTTOM : 0);
    names.push({
      name: crewMember.name,
      dot: CREW_DOTS[crewMember.color],
      foreman: crewMember.foreman,
      subLines,
      chipHeight,
      noteLines,
      y,
      height,
    });
    y += height + NAME_GAP;
  }

  return { names, height: Math.max(0, y - NAME_GAP) };
}

/** The Notes for the day card, starting at `top`; null when there are none. */
function layOutNotes(
  dayNotes: string[],
  ctx: CanvasRenderingContext2D,
  look: Look,
  top: number,
): NotesLayout | null {
  if (dayNotes.length === 0) return null;
  setType(ctx, look.type.dayNote);
  let y = CARD_PAD + YARD_LINE + PART_GAP;
  const notes = dayNotes.map((note, index) => {
    if (index > 0) y += 2 * DAY_NOTE_GAP;
    const lines = wrap(ctx, note, CARD_INNER_WIDTH - TEXT_INDENT).map((text, at) => ({
      text,
      first: at === 0,
    }));
    const laid = { top: y, lines };
    y += lines.length * DAY_NOTE_LINE;
    return laid;
  });
  return { top, height: y + CARD_PAD, notes };
}

/** Breaks text into lines no wider than `width`, at spaces. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const longer = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(longer).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = longer;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// --- Drawing ----------------------------------------------------------------

function draw(
  ctx: CanvasRenderingContext2D,
  view: CrewView,
  layout: Layout,
  look: Look,
  logo: HTMLImageElement,
) {
  // The board's warm off-white, with the white cards on it, as on the screen.
  ctx.fillStyle = PALETTE.canvas;
  ctx.fillRect(0, 0, WIDTH, layout.height);
  ctx.textBaseline = 'middle';

  const logoWidth = (logo.naturalWidth / logo.naturalHeight) * LOGO_HEIGHT;
  ctx.drawImage(logo, MARGIN, MARGIN, logoWidth, LOGO_HEIGHT);

  if (view.updated) drawUpdated(ctx, look);

  ctx.fillStyle = PALETTE.ink;
  setType(ctx, look.type.date);
  ctx.fillText(
    fullDate(view.date).toUpperCase(),
    MARGIN + 2,
    layout.dateTop + DATE_HEIGHT / 2 - 6,
    CARD_WIDTH - 4,
  );

  for (const card of layout.cards) drawCard(ctx, card, look);
  if (layout.notes) drawNotes(ctx, layout.notes, look);
}

/** The UPDATED marker: a solid bar of the alert red under the logo. */
function drawUpdated(ctx: CanvasRenderingContext2D, look: Look) {
  const top = MARGIN + LOGO_HEIGHT + LOGO_GAP;
  const middle = top + UPDATED_HEIGHT / 2 + 2;
  ctx.fillStyle = PALETTE.alert;
  ctx.beginPath();
  ctx.roundRect(MARGIN, top, CARD_WIDTH, UPDATED_HEIGHT, look.radius.card);
  ctx.fill();

  ctx.fillStyle = PALETTE.paper;
  setType(ctx, look.type.updated);
  ctx.fillText('UPDATED', MARGIN + UPDATED_PAD_X, middle);
  const afterWord = MARGIN + UPDATED_PAD_X + ctx.measureText('UPDATED').width + 18;
  setType(ctx, look.type.updatedNote);
  ctx.fillText(
    'This replaces the earlier schedule',
    afterWord,
    middle,
    MARGIN + CARD_WIDTH - UPDATED_PAD_X - afterWord,
  );
}

/** A white card with a fine edge drawn wholly inside it. */
function drawCardGround(ctx: CanvasRenderingContext2D, top: number, height: number, look: Look) {
  ctx.beginPath();
  ctx.roundRect(CARD_X, top, CARD_WIDTH, height, look.radius.card);
  ctx.fillStyle = PALETTE.paper;
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(
    CARD_X + CARD_EDGE / 2,
    top + CARD_EDGE / 2,
    CARD_WIDTH - CARD_EDGE,
    height - CARD_EDGE,
    look.radius.card,
  );
  ctx.strokeStyle = PALETTE.line;
  ctx.lineWidth = CARD_EDGE;
  ctx.stroke();
}

/** A hairline across the card, at `y`. */
function drawRule(ctx: CanvasRenderingContext2D, y: number) {
  ctx.fillStyle = PALETTE.line;
  ctx.fillRect(CARD_INNER_X, y, CARD_INNER_WIDTH, CARD_EDGE);
}

function drawCard(ctx: CanvasRenderingContext2D, card: CardLayout, look: Look) {
  const { top, isJob } = card;
  drawCardGround(ctx, top, card.height, look);

  // The name in capitals with the Job number small after it, and the count at the right.
  const headTop = top + CARD_PAD;
  const line = isJob ? JOB_LINE : YARD_LINE;
  ctx.fillStyle = PALETTE.ink;
  setType(ctx, isJob ? look.type.job : look.type.yard);
  card.titleLines.forEach((title, index) =>
    ctx.fillText(title, CARD_INNER_X, headTop + (index + 0.5) * line + 2, CARD_INNER_WIDTH),
  );
  const lastTitle = card.titleLines.at(-1) ?? '';
  const titleEnd = CARD_INNER_X + ctx.measureText(lastTitle).width;
  ctx.fillStyle = PALETTE.muted;
  setType(ctx, look.type.count);
  if (card.number) {
    const lastMiddle = headTop + (card.titleLines.length - 0.5) * line + 4;
    ctx.fillText(card.number, titleEnd + NUMBER_GAP, lastMiddle);
  }
  ctx.textAlign = 'right';
  ctx.fillText(card.countText, CARD_INNER_X + CARD_INNER_WIDTH, headTop + line / 2 + 4);
  ctx.textAlign = 'left';

  // The Tasks: plain lines, then a rule above the names.
  if (card.taskLines.length > 0) {
    const taskLine = isJob ? TASK_LINE : YARD_TASK_LINE;
    const tasksTop = headTop + card.titleLines.length * line + PART_GAP;
    ctx.fillStyle = PALETTE.ink;
    setType(ctx, isJob ? look.type.task : look.type.yardTask);
    card.taskLines.forEach((task, index) =>
      drawBulletLine(ctx, task, tasksTop + (index + 0.5) * taskLine + 1),
    );
    drawRule(ctx, tasksTop + card.taskLines.length * taskLine + TASKS_RULE_GAP - CARD_EDGE);
  }

  for (const box of card.names) drawName(ctx, box, top + card.namesTop + box.y, look);
}

function drawName(ctx: CanvasRenderingContext2D, box: NameBox, y: number, look: Look) {
  const x = CARD_INNER_X;
  const width = CARD_INNER_WIDTH;

  // A Note hangs under its name, in one red-tinted piece with it.
  if (box.noteLines.length > 0) {
    ctx.fillStyle = PALETTE.alertWashStrong;
    ctx.beginPath();
    ctx.roundRect(x, y, width, box.height, look.radius.chip);
    ctx.fill();
    ctx.fillStyle = PALETTE.alert;
    setType(ctx, look.type.note);
    const notesTop = y + box.chipHeight + NOTE_PAD_TOP;
    box.noteLines.forEach((line, index) =>
      ctx.fillText(line, x + NAME_PAD_X, notesTop + (index + 0.5) * NOTE_LINE + 1, width - 2 * NAME_PAD_X),
    );
  }

  // The chip: grey, or black for a Foreman.
  ctx.fillStyle = box.foreman ? PALETTE.ink : PALETTE.chip;
  ctx.beginPath();
  ctx.roundRect(x, y, width, box.chipHeight, look.radius.chip);
  ctx.fill();

  const hasSubs = box.subLines.length > 0;
  const middle = hasSubs ? y + SUBS_PAD_Y + SUBS_NAME_LINE / 2 + 1 : y + NAME_HEIGHT / 2 + 1;
  const textX = x + NAME_PAD_X + DOT + DOT_GAP;
  const textWidth = x + width - NAME_PAD_X - textX;

  // The dot of their color (white on a Foreman's black chip).
  ctx.fillStyle = box.foreman ? PALETTE.paper : box.dot;
  ctx.beginPath();
  ctx.arc(x + NAME_PAD_X + DOT / 2, middle, DOT / 2, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = box.foreman ? PALETTE.paper : PALETTE.ink;
  setType(ctx, look.type.name);
  ctx.fillText(box.name, textX, middle, textWidth);

  // Their Person Tasks: smaller lines under the name, in the same chip.
  ctx.fillStyle = box.foreman ? PALETTE.chipInkSoft : PALETTE.inkSoft;
  setType(ctx, look.type.personTask);
  box.subLines.forEach((line, index) =>
    ctx.fillText(line, textX, y + SUBS_PAD_Y + SUBS_NAME_LINE + (index + 0.5) * SUB_LINE, textWidth),
  );
}

/** One line of a Task or Day Note, centred on `middle`: a bullet before the first line of each. */
function drawBulletLine(ctx: CanvasRenderingContext2D, line: BulletLine, middle: number) {
  if (line.first) {
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.beginPath();
    ctx.arc(CARD_INNER_X + BULLET / 2, middle, BULLET / 2, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText(line.text, CARD_INNER_X + TEXT_INDENT, middle, CARD_INNER_WIDTH - TEXT_INDENT);
}

/** The Notes for the day: a title, then each note, ruled apart. */
function drawNotes(ctx: CanvasRenderingContext2D, layout: NotesLayout, look: Look) {
  drawCardGround(ctx, layout.top, layout.height, look);
  ctx.fillStyle = PALETTE.ink;
  setType(ctx, look.type.yard);
  ctx.fillText('NOTES FOR THE DAY', CARD_INNER_X, layout.top + CARD_PAD + YARD_LINE / 2 + 2);

  layout.notes.forEach((note, index) => {
    const noteTop = layout.top + note.top;
    if (index > 0) drawRule(ctx, noteTop - DAY_NOTE_GAP - CARD_EDGE / 2);
    setType(ctx, look.type.dayNote);
    note.lines.forEach((line, at) =>
      drawBulletLine(ctx, line, noteTop + (at + 0.5) * DAY_NOTE_LINE + 1),
    );
  });
}

import { CREW_COLORS, PALETTE, crewInk } from '../palette';
import { fullDate, type Color, type CrewView, type ScheduleRow } from '../schedule-rules';

/**
 * Draws the crew view as a picture (a PNG) of the Daily Schedule, made to be
 * read on a phone: the date at the top, then the cards of the Scheduler's
 * board one under the other, one for each Job and Standing Row. A card is the
 * Job, large, with how many are on it; the day's Tasks in a tinted box; then
 * the names, one to a line, each the full width of the card and in its color.
 * A Note hangs under its name in red. It draws exactly the rows it is given
 * and nothing else: no buttons and no Not Placed list. No rule is applied here.
 *
 * Drawn by hand on a canvas rather than photographed from the screen, so it
 * is the same picture whatever the Scheduler's window looks like. It is
 * narrow with large text, to be readable in Slack on a phone, and drawn at
 * twice its size so it stays sharp.
 */
export async function renderCrewPicture(view: CrewView): Promise<Blob> {
  const look = readLook();
  // The type is bundled with the page but only fetched when first used:
  // make sure every kind the picture draws is there before measuring.
  await Promise.all(Object.values(look.type).map(({ font }) => document.fonts.load(font)));

  const canvas = document.createElement('canvas');
  const measure = canvas.getContext('2d')!;
  const layout = layOut(view, measure, look);

  // Sizing the canvas resets its context, so size first, then draw.
  canvas.width = WIDTH * SHARPNESS;
  canvas.height = layout.height * SHARPNESS;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SHARPNESS, SHARPNESS);
  draw(ctx, view, layout, look);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not draw the picture'))),
      'image/png',
    );
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
const REM = 28;

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
  | 'count'
  | 'tasksHeading'
  | 'task'
  | 'name'
  | 'note';

/** The shared look as the picture uses it: its kinds of text and its corners. */
interface Look {
  type: Record<Kind, Type>;
  /** Corner radii, in the picture's pixels. */
  radius: { card: number; control: number; chip: number; pill: number };
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

  // As on the screen: the condensed face, bold, for the date and the Jobs;
  // strong for the names and Tasks; small capitals for the Tasks' label.
  return {
    type: {
      date: type(display, 'bold', 58, 'heading'),
      updated: type(display, 'bold', 40, 'label'),
      updatedNote: type(text, 'strong', 25),
      job: type(display, 'bold', 48, 'heading'),
      count: type(text, 'strong', 24),
      tasksHeading: type(text, 'bold', 20, 'label'),
      task: type(text, 'strong', 29),
      name: type(text, 'strong', 30, 'name'),
      note: type(text, 'strong', 27),
    },
    radius: {
      card: corner('card'),
      control: corner('control'),
      chip: corner('chip'),
      pill: corner('pill'),
    },
  };
}

/** Sets the type to draw or measure with. */
function setType(ctx: CanvasRenderingContext2D, { font, letterSpacing }: Type) {
  ctx.font = font;
  ctx.letterSpacing = letterSpacing;
}

const UPDATED_HEIGHT = 76;
const UPDATED_GAP = 18;
const UPDATED_PAD_X = 22;
const DATE_HEIGHT = 92;

/** A card: one Job or Standing Row. */
const CARD_X = MARGIN;
const CARD_WIDTH = WIDTH - 2 * MARGIN;
const CARD_GAP = 20;
const CARD_EDGE = 2;
const CARD_PAD = 28;
const CARD_INNER_X = CARD_X + CARD_PAD;
const CARD_INNER_WIDTH = CARD_WIDTH - 2 * CARD_PAD;
/** The space between the parts of a card: the head, the Tasks, the names. */
const PART_GAP = 18;

/** The head: the Job, and how many are on it in a pill at the right. */
const JOB_LINE = 54;
const COUNT_HEIGHT = 42;
const COUNT_PAD_X = 16;
const HEAD_GAP = 16;

/** The Tasks: a tinted box, a small label, then one Task to a line with a square bullet. */
const TASKS_EDGE = 2;
const TASKS_PAD_X = 24;
const TASKS_PAD_Y = 20;
const TASKS_HEADING_LINE = 28;
const TASKS_GAP = 10;
const TASK_LINE = 38;
const BULLET = 16;
const BULLET_GAP = 16;
const TASK_X = CARD_INNER_X + TASKS_PAD_X + BULLET + BULLET_GAP;
const TASK_WIDTH = CARD_INNER_X + CARD_INNER_WIDTH - TASKS_PAD_X - TASK_X;

/** Who: one name to a line, every one the width of the card. */
const NAME_HEIGHT = 74;
const NAME_GAP = 14;
const NAME_PAD_X = 24;
const NOTE_LINE = 34;
const NOTE_PAD_TOP = 6;
const NOTE_PAD_BOTTOM = 12;

// --- Working out where everything goes --------------------------------------

/** One name in the column of names, with its Note under it. `y` is from the top of the column. */
interface NameBox {
  name: string;
  color: Color;
  noteLines: string[];
  y: number;
  height: number;
}

/** One line of a Task: the first line of it, or the rest of one too long for a line. */
interface TaskLine {
  text: string;
  rest: boolean;
}

interface CardLayout {
  row: ScheduleRow;
  top: number;
  height: number;
  jobLines: string[];
  countText: string;
  countWidth: number;
  taskLines: TaskLine[];
  /** From the top of the card. */
  tasksTop: number;
  tasksHeight: number;
  /** From the top of the card. */
  namesTop: number;
  names: NameBox[];
}

interface Layout {
  dateTop: number;
  cards: CardLayout[];
  height: number;
}

/** How many are on a Job or Standing Row, in plain words, as on the screen. */
const headcount = (count: number): string => (count === 1 ? '1 person' : `${count} people`);

function layOut(view: CrewView, ctx: CanvasRenderingContext2D, look: Look): Layout {
  const dateTop = MARGIN + (view.updated ? UPDATED_HEIGHT + UPDATED_GAP : 0);

  let top = dateTop + DATE_HEIGHT;
  const cards = view.rows.map((row): CardLayout => {
    setType(ctx, look.type.count);
    const countText = headcount(row.who.length);
    const countWidth = Math.ceil(ctx.measureText(countText).width) + 2 * COUNT_PAD_X;

    setType(ctx, look.type.job);
    const jobLines = wrap(ctx, row.label, CARD_INNER_WIDTH - countWidth - HEAD_GAP);
    const headHeight = Math.max(jobLines.length * JOB_LINE, COUNT_HEIGHT);

    setType(ctx, look.type.task);
    const taskLines = row.tasks.flatMap((task) =>
      wrap(ctx, task, TASK_WIDTH).map((text, index) => ({ text, rest: index > 0 })),
    );
    const tasksTop = CARD_PAD + headHeight + PART_GAP;
    const tasksHeight =
      taskLines.length > 0
        ? 2 * TASKS_PAD_Y + TASKS_HEADING_LINE + TASKS_GAP + taskLines.length * TASK_LINE
        : 0;

    const namesTop = tasksTop + (tasksHeight > 0 ? tasksHeight + PART_GAP : 0);
    const { names, height: namesHeight } = stackNames(ctx, row, look);

    const height = namesTop + namesHeight + CARD_PAD;
    const card = {
      row,
      top,
      height,
      jobLines,
      countText,
      countWidth,
      taskLines,
      tasksTop,
      tasksHeight,
      namesTop,
      names,
    };
    top += height + CARD_GAP;
    return card;
  });

  return { dateTop, cards, height: top - CARD_GAP + MARGIN };
}

/** Names one under the other, each with its Note (if any) hanging under it. */
function stackNames(ctx: CanvasRenderingContext2D, row: ScheduleRow, look: Look) {
  setType(ctx, look.type.note);
  const names: NameBox[] = [];
  let y = 0;

  for (const { crewMember, note } of row.who) {
    const noteLines = note ? wrap(ctx, note, CARD_INNER_WIDTH - 2 * NAME_PAD_X) : [];
    const height =
      NAME_HEIGHT +
      (noteLines.length > 0 ? NOTE_PAD_TOP + noteLines.length * NOTE_LINE + NOTE_PAD_BOTTOM : 0);
    const { name, color } = crewMember;
    names.push({ name, color, noteLines, y, height });
    y += height + NAME_GAP;
  }

  return { names, height: Math.max(0, y - NAME_GAP) };
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

function draw(ctx: CanvasRenderingContext2D, view: CrewView, layout: Layout, look: Look) {
  // The board's calm grey, with the white cards on it, as on the screen.
  ctx.fillStyle = PALETTE.canvas;
  ctx.fillRect(0, 0, WIDTH, layout.height);
  ctx.textBaseline = 'middle';

  if (view.updated) drawUpdated(ctx, look);

  ctx.fillStyle = PALETTE.ink;
  setType(ctx, look.type.date);
  ctx.fillText(fullDate(view.date), MARGIN + 2, layout.dateTop + DATE_HEIGHT / 2 - 8, CARD_WIDTH - 4);

  // "WEDNESDAY'S WORK": the Tasks are for the day being scheduled, as on the screen.
  const tasksHeading = `${fullDate(view.date).split(',')[0]}'s work`.toUpperCase();
  for (const card of layout.cards) drawCard(ctx, card, look, tasksHeading);
}

/** The UPDATED marker: a solid bar of the alert red across the top. */
function drawUpdated(ctx: CanvasRenderingContext2D, look: Look) {
  const middle = MARGIN + UPDATED_HEIGHT / 2 + 2;
  ctx.fillStyle = PALETTE.alert;
  ctx.beginPath();
  ctx.roundRect(MARGIN, MARGIN, CARD_WIDTH, UPDATED_HEIGHT, look.radius.card);
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

function drawCard(
  ctx: CanvasRenderingContext2D,
  card: CardLayout,
  look: Look,
  tasksHeading: string,
) {
  const { top, height } = card;

  // The card: white, with its fine edge drawn wholly inside it.
  ctx.beginPath();
  ctx.roundRect(
    CARD_X + CARD_EDGE / 2,
    top + CARD_EDGE / 2,
    CARD_WIDTH - CARD_EDGE,
    height - CARD_EDGE,
    look.radius.card,
  );
  ctx.fillStyle = PALETTE.paper;
  ctx.fill();
  ctx.strokeStyle = PALETTE.line;
  ctx.lineWidth = CARD_EDGE;
  ctx.stroke();

  // The head: the Job, and the count in its pill at the right, level with the Job's first line.
  const headTop = top + CARD_PAD;
  ctx.fillStyle = PALETTE.ink;
  setType(ctx, look.type.job);
  card.jobLines.forEach((line, index) =>
    ctx.fillText(line, CARD_INNER_X, headTop + (index + 0.5) * JOB_LINE + 2, CARD_INNER_WIDTH),
  );
  const countX = CARD_INNER_X + CARD_INNER_WIDTH - card.countWidth;
  const countTop = headTop + (JOB_LINE - COUNT_HEIGHT) / 2;
  ctx.fillStyle = PALETTE.wash;
  ctx.beginPath();
  ctx.roundRect(countX, countTop, card.countWidth, COUNT_HEIGHT, look.radius.pill);
  ctx.fill();
  ctx.fillStyle = PALETTE.ink;
  setType(ctx, look.type.count);
  ctx.fillText(card.countText, countX + COUNT_PAD_X, countTop + COUNT_HEIGHT / 2 + 1);

  if (card.tasksHeight > 0) drawTasks(ctx, card, look, tasksHeading);

  // Who: the names, one under the other.
  for (const box of card.names) drawName(ctx, box, CARD_INNER_X, top + card.namesTop + box.y, look);
}

function drawTasks(ctx: CanvasRenderingContext2D, card: CardLayout, look: Look, heading: string) {
  const boxTop = card.top + card.tasksTop;

  ctx.beginPath();
  ctx.roundRect(
    CARD_INNER_X + TASKS_EDGE / 2,
    boxTop + TASKS_EDGE / 2,
    CARD_INNER_WIDTH - TASKS_EDGE,
    card.tasksHeight - TASKS_EDGE,
    look.radius.control,
  );
  ctx.fillStyle = PALETTE.accentWash;
  ctx.fill();
  ctx.strokeStyle = PALETTE.accentLine;
  ctx.lineWidth = TASKS_EDGE;
  ctx.stroke();

  const headingTop = boxTop + TASKS_PAD_Y;
  ctx.fillStyle = PALETTE.accentDark;
  setType(ctx, look.type.tasksHeading);
  ctx.fillText(heading, CARD_INNER_X + TASKS_PAD_X, headingTop + TASKS_HEADING_LINE / 2 + 1);

  const linesTop = headingTop + TASKS_HEADING_LINE + TASKS_GAP;
  setType(ctx, look.type.task);
  card.taskLines.forEach(({ text, rest }, index) => {
    const lineTop = linesTop + index * TASK_LINE;
    // A square bullet starts each Task; the rest of one too long for a line carries on beside it.
    if (!rest) {
      ctx.fillStyle = PALETTE.accent;
      ctx.beginPath();
      ctx.roundRect(
        CARD_INNER_X + TASKS_PAD_X,
        lineTop + (TASK_LINE - BULLET) / 2,
        BULLET,
        BULLET,
        3,
      );
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText(text, TASK_X, lineTop + TASK_LINE / 2 + 1, TASK_WIDTH);
  });
}

function drawName(ctx: CanvasRenderingContext2D, box: NameBox, x: number, y: number, look: Look) {
  const width = CARD_INNER_WIDTH;
  const middle = y + NAME_HEIGHT / 2 + 1;

  // A Note hangs under its name, in one red-tinted piece with it.
  if (box.noteLines.length > 0) {
    ctx.fillStyle = PALETTE.alertWashStrong;
    ctx.beginPath();
    ctx.roundRect(x, y, width, box.height, look.radius.chip);
    ctx.fill();
    ctx.fillStyle = PALETTE.alert;
    setType(ctx, look.type.note);
    const notesTop = y + NAME_HEIGHT + NOTE_PAD_TOP;
    box.noteLines.forEach((line, index) =>
      ctx.fillText(
        line,
        x + NAME_PAD_X,
        notesTop + (index + 0.5) * NOTE_LINE + 1,
        width - 2 * NAME_PAD_X,
      ),
    );
  }

  // The name: a cell of the Crew Member's color.
  ctx.fillStyle = CREW_COLORS[box.color];
  ctx.beginPath();
  ctx.roundRect(x, y, width, NAME_HEIGHT, look.radius.chip);
  ctx.fill();

  ctx.fillStyle = crewInk(box.color);
  setType(ctx, look.type.name);
  ctx.fillText(box.name, x + NAME_PAD_X, middle, width - 2 * NAME_PAD_X);
}

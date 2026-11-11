import logoUrl from '../assets/schreiber-logo.png';
import { CREW_COLORS, PALETTE, crewInk } from '../palette';
import { fullDate, type Color, type CrewView, type Roster, type ScheduleRow } from '../schedule-rules';

/**
 * Draws the crew view as a picture (a PNG) of the Daily Schedule, made to be
 * read on a phone: the Schreiber logo and the date at the top, then the
 * cards of the Scheduler's board one under the other. A Job card is its
 * number and how many are on it, the Job's name in large capitals, the day's
 * Tasks in a pale yellow box, then the names, one to a line, each the full
 * width of the card and in its color. Shop and Trucking are the same with
 * their Tasks as a smaller note. A Note hangs under its name in red. It draws
 * exactly the rows it is given and nothing else: no buttons and no Not Placed
 * list. No rule is applied here.
 *
 * Drawn by hand on a canvas rather than photographed from the screen, so it
 * is the same picture whatever the Scheduler's window looks like. It is
 * narrow with large text, to be readable in Slack on a phone, and drawn at
 * twice its size so it stays sharp.
 *
 * The roster, when given, splits a Job's label into its number and its name
 * as the screen shows them; without it (or for a Job no longer on it) the
 * label is the name.
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
  | 'over'
  | 'job'
  | 'yard'
  | 'count'
  | 'tasksHeading'
  | 'task'
  | 'note'
  | 'yardTask'
  | 'name';

/** The shared look as the picture uses it: its kinds of text and its corners. */
interface Look {
  type: Record<Kind, Type>;
  /** Corner radii, in the picture's pixels. */
  radius: { card: number; control: number; chip: number; note: number };
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

  // As on the screen: Oswald capitals for the date and the places; Inter,
  // strong, for the names and Tasks; small capitals for the Tasks' label.
  return {
    type: {
      date: type(display, 'display', 52, 'heading'),
      updated: type(display, 'display', 38, 'button'),
      updatedNote: type(text, 'strong', 24),
      over: type(text, 'strong', 22, 'small'),
      job: type(display, 'display', 48, 'heading'),
      yard: type(display, 'display', 40, 'heading'),
      count: type(text, 'strong', 22),
      tasksHeading: type(text, 'bold', 19, 'label'),
      task: type(text, 'strong', 28),
      yardTask: type(text, 'strong', 24),
      name: type(text, 'strong', 29, 'name'),
      note: type(text, 'strong', 26),
    },
    radius: {
      card: corner('card'),
      control: corner('control'),
      chip: corner('chip'),
      note: corner('note'),
    },
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

/** A card: one Job or Standing Row. */
const CARD_X = MARGIN;
const CARD_WIDTH = WIDTH - 2 * MARGIN;
const CARD_GAP = 20;
const CARD_EDGE = 2;
const CARD_PAD = 28;
const CARD_INNER_X = CARD_X + CARD_PAD;
const CARD_INNER_WIDTH = CARD_WIDTH - 2 * CARD_PAD;
/** The space between the parts of a card: the head, the Tasks, the names. */
const PART_GAP = 16;

/** A Job's head: its number and count, then its name. */
const OVER_LINE = 30;
const JOB_LINE = 56;
/** A Standing Row's head: its name, and its count at the right. */
const YARD_LINE = 50;

/** A Job's Tasks: a pale yellow box, a small label, then one Task to a line with a square bullet. */
const TASKS_EDGE = 2;
const TASKS_PAD_X = 24;
const TASKS_PAD_Y = 20;
const TASKS_HEADING_LINE = 28;
const TASKS_GAP = 10;
const TASK_LINE = 38;
const BULLET = 16;
const BULLET_GAP = 16;

/** Shop's and Trucking's Tasks: the same, smaller, with no label or edge. */
const YARD_TASKS_PAD_X = 18;
const YARD_TASKS_PAD_Y = 12;
const YARD_TASK_LINE = 34;
const YARD_BULLET = 10;
const YARD_BULLET_GAP = 14;

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

/** How a card's Tasks are set: a Job's box, or Shop's and Trucking's smaller note. */
interface TasksStyle {
  padX: number;
  padY: number;
  line: number;
  bullet: number;
  bulletGap: number;
  heading: boolean;
}

const JOB_TASKS: TasksStyle = {
  padX: TASKS_PAD_X,
  padY: TASKS_PAD_Y,
  line: TASK_LINE,
  bullet: BULLET,
  bulletGap: BULLET_GAP,
  heading: true,
};

const YARD_TASKS: TasksStyle = {
  padX: YARD_TASKS_PAD_X,
  padY: YARD_TASKS_PAD_Y,
  line: YARD_TASK_LINE,
  bullet: YARD_BULLET,
  bulletGap: YARD_BULLET_GAP,
  heading: false,
};

interface CardLayout {
  row: ScheduleRow;
  isJob: boolean;
  top: number;
  height: number;
  /** A Job's number and count ("J2601 · 5 people"); a Standing Row's count alone. */
  overText: string;
  titleLines: string[];
  tasks: TasksStyle;
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

/** A Job's number and name as the screen shows them ("JOB" when it has no number). */
function jobParts(row: ScheduleRow, roster: Roster | undefined): { number: string; name: string } {
  const { destination } = row;
  const job =
    destination.kind === 'job'
      ? roster?.jobs.find((candidate) => candidate.id === destination.jobId)
      : undefined;
  return job ? { number: job.jobNumber ?? 'JOB', name: job.name } : { number: 'JOB', name: row.label };
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
    const count = headcount(row.who.length);
    setType(ctx, look.type.count);
    const countWidth = Math.ceil(ctx.measureText(count).width);

    let overText: string;
    let titleLines: string[];
    let headHeight: number;
    if (isJob) {
      const { number, name } = jobParts(row, roster);
      overText = `${number} · ${count}`;
      setType(ctx, look.type.job);
      titleLines = wrap(ctx, name.toUpperCase(), CARD_INNER_WIDTH);
      headHeight = OVER_LINE + titleLines.length * JOB_LINE;
    } else {
      overText = count;
      setType(ctx, look.type.yard);
      titleLines = wrap(ctx, row.label.toUpperCase(), CARD_INNER_WIDTH - countWidth - 16);
      headHeight = titleLines.length * YARD_LINE;
    }

    const tasks = isJob ? JOB_TASKS : YARD_TASKS;
    setType(ctx, isJob ? look.type.task : look.type.yardTask);
    const taskWidth = CARD_INNER_WIDTH - 2 * tasks.padX - tasks.bullet - tasks.bulletGap;
    const taskLines = row.tasks.flatMap((task) =>
      wrap(ctx, task, taskWidth).map((text, index) => ({ text, rest: index > 0 })),
    );
    const tasksTop = CARD_PAD + headHeight + PART_GAP;
    const tasksHeight =
      taskLines.length > 0
        ? 2 * tasks.padY +
          (tasks.heading ? TASKS_HEADING_LINE + TASKS_GAP : 0) +
          taskLines.length * tasks.line
        : 0;

    const namesTop = tasksTop + (tasksHeight > 0 ? tasksHeight + PART_GAP : 0);
    const { names, height: namesHeight } = stackNames(ctx, row, look);

    const height = namesTop + namesHeight + CARD_PAD;
    const card: CardLayout = {
      row,
      isJob,
      top,
      height,
      overText,
      titleLines,
      tasks,
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

  // "WEDNESDAY'S WORK": the Tasks are for the day being scheduled, as on the screen.
  const tasksHeading = `${fullDate(view.date).split(',')[0]}'s work`.toUpperCase();
  for (const card of layout.cards) drawCard(ctx, card, look, tasksHeading);
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

function drawCard(
  ctx: CanvasRenderingContext2D,
  card: CardLayout,
  look: Look,
  tasksHeading: string,
) {
  const { top, height } = card;

  // The card: white, with its fine edge drawn wholly inside it and a soft shadow under it.
  ctx.save();
  ctx.shadowColor = PALETTE.shadow;
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.roundRect(CARD_X, top, CARD_WIDTH, height, look.radius.card);
  ctx.fillStyle = PALETTE.paper;
  ctx.fill();
  ctx.restore();
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

  const headTop = top + CARD_PAD;
  if (card.isJob) {
    // A Job: its number and count, small, then its name in large capitals.
    ctx.fillStyle = PALETTE.muted;
    setType(ctx, look.type.over);
    ctx.fillText(card.overText, CARD_INNER_X, headTop + OVER_LINE / 2, CARD_INNER_WIDTH);
    ctx.fillStyle = PALETTE.ink;
    setType(ctx, look.type.job);
    card.titleLines.forEach((line, index) =>
      ctx.fillText(
        line,
        CARD_INNER_X,
        headTop + OVER_LINE + (index + 0.5) * JOB_LINE + 2,
        CARD_INNER_WIDTH,
      ),
    );
  } else {
    // Shop, Trucking, Off Work: the name, and how many at the right.
    ctx.fillStyle = PALETTE.ink;
    setType(ctx, look.type.yard);
    card.titleLines.forEach((line, index) =>
      ctx.fillText(line, CARD_INNER_X, headTop + (index + 0.5) * YARD_LINE + 2, CARD_INNER_WIDTH),
    );
    ctx.fillStyle = PALETTE.muted;
    setType(ctx, look.type.count);
    ctx.textAlign = 'right';
    ctx.fillText(card.overText, CARD_INNER_X + CARD_INNER_WIDTH, headTop + YARD_LINE / 2 + 4);
    ctx.textAlign = 'left';
  }

  if (card.tasksHeight > 0) drawTasks(ctx, card, look, tasksHeading);

  // Who: the names, one under the other.
  for (const box of card.names) drawName(ctx, box, CARD_INNER_X, top + card.namesTop + box.y, look);
}

function drawTasks(ctx: CanvasRenderingContext2D, card: CardLayout, look: Look, heading: string) {
  const { tasks } = card;
  const boxTop = card.top + card.tasksTop;

  ctx.beginPath();
  if (tasks.heading) {
    // A Job's: the pale yellow box with its edge.
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
  } else {
    // Shop's and Trucking's: the same yellow, no edge.
    ctx.roundRect(CARD_INNER_X, boxTop, CARD_INNER_WIDTH, card.tasksHeight, look.radius.note);
    ctx.fillStyle = PALETTE.accentWash;
    ctx.fill();
  }

  let linesTop = boxTop + tasks.padY;
  if (tasks.heading) {
    ctx.fillStyle = PALETTE.accentDark;
    setType(ctx, look.type.tasksHeading);
    ctx.fillText(heading, CARD_INNER_X + tasks.padX, linesTop + TASKS_HEADING_LINE / 2 + 1);
    linesTop += TASKS_HEADING_LINE + TASKS_GAP;
  }

  const bulletX = CARD_INNER_X + tasks.padX;
  const textX = bulletX + tasks.bullet + tasks.bulletGap;
  const textWidth = CARD_INNER_X + CARD_INNER_WIDTH - tasks.padX - textX;
  setType(ctx, tasks.heading ? look.type.task : look.type.yardTask);
  card.taskLines.forEach(({ text, rest }, index) => {
    const lineTop = linesTop + index * tasks.line;
    // A square black bullet starts each Task; the rest of one too long for a line carries on beside it.
    if (!rest) {
      ctx.fillStyle = PALETTE.ink;
      ctx.beginPath();
      ctx.roundRect(
        bulletX,
        lineTop + (tasks.line - tasks.bullet) / 2,
        tasks.bullet,
        tasks.bullet,
        tasks.heading ? 3 : 2,
      );
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText(text, textX, lineTop + tasks.line / 2 + 1, textWidth);
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

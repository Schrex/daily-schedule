import logoUrl from '../assets/schreiber-logo.png';
import { CREW_COLORS, PALETTE, crewInk } from '../palette';
import {
  fullDate,
  notePieces,
  type Color,
  type CrewView,
  type NotePiece,
  type Roster,
  type ScheduleRow,
} from '../schedule-rules';

/**
 * Draws the crew view as a picture (a PNG) of the Daily Schedule, made to be
 * read on a phone: the Schreiber logo and the date at the top, then the
 * cards of the Scheduler's board one under the other. A Job card is its
 * number over the Job's name in large capitals, how many are on it at the
 * top right, the day's
 * Tasks in a pale yellow box, then the names, one to a line, each the full
 * width of the card and in its color. Shop and Trucking are the same with
 * their Tasks as a smaller note. A Crew Member's Person Tasks are smaller
 * lines inside their name's chip, and a Note hangs under it in red. The
 * Notes for the day, if any, are a last card, with the Crew Members and Jobs
 * they name marked as on the screen. It draws
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
  | 'name'
  | 'personTask'
  | 'dayNotesTitle'
  | 'dayNote'
  | 'dayNoteMark';

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
      personTask: type(text, 'strong', 23),
      dayNotesTitle: type(display, 'display', 40, 'heading'),
      dayNote: type(text, 'body', 27),
      dayNoteMark: type(text, 'bold', 27),
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
/** Person Tasks inside a name's chip: the name on a shorter line, then one line each. */
const SUBS_NAME_LINE = 40;
const SUBS_PAD_TOP = 14;
const SUBS_PAD_BOTTOM = 16;
const SUB_LINE = 31;

/** The Notes for the day: a last card, each note on a pale ground, lines of text with marks. */
const NOTES_TITLE_LINE = 50;
const DAY_NOTE_PAD_X = 20;
const DAY_NOTE_PAD_Y = 14;
const DAY_NOTE_LINE = 44;
const DAY_NOTE_GAP = 14;
const MARK_PAD_X = 8;
const MARK_HEIGHT = 36;

// --- Working out where everything goes --------------------------------------

/** One name in the column of names, with its Note under it. `y` is from the top of the column. */
interface NameBox {
  name: string;
  color: Color;
  /** The Person Tasks, already broken into lines that fit the chip. */
  subLines: string[];
  /** The height of the name's chip, Person Tasks included; the Note hangs under it. */
  chipHeight: number;
  noteLines: string[];
  y: number;
  height: number;
}

/** One word of a Day Note on its line: where it starts, and the mark it is part of, if any. */
interface NoteWord {
  text: string;
  x: number;
  width: number;
  kind: NotePiece['kind'];
  /** Words of one marked piece on one line share one mark. */
  piece: number;
}

interface DayNotesLayout {
  top: number;
  height: number;
  /** Each note: its lines of words, and its top from the top of the card. */
  notes: { top: number; lines: NoteWord[][] }[];
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
  /** A Job's number ("J2601"); empty for a Standing Row. */
  overText: string;
  /** How many are on it ("5 people"), at the top right. */
  countText: string;
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
  dayNotes: DayNotesLayout | null;
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
      overText = number;
      setType(ctx, look.type.job);
      titleLines = wrap(ctx, name.toUpperCase(), CARD_INNER_WIDTH);
      headHeight = OVER_LINE + titleLines.length * JOB_LINE;
    } else {
      overText = '';
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
      countText: count,
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

  const dayNotes = layOutDayNotes(view.dayNotes ?? [], roster, ctx, look, top);
  if (dayNotes) top += dayNotes.height + CARD_GAP;

  return { dateTop, cards, dayNotes, height: top - CARD_GAP + MARGIN };
}

/** The Notes for the day card, starting at `top`; null when there are none. */
function layOutDayNotes(
  notes: string[],
  roster: Roster | undefined,
  ctx: CanvasRenderingContext2D,
  look: Look,
  top: number,
): DayNotesLayout | null {
  if (notes.length === 0) return null;
  const width = CARD_INNER_WIDTH - 2 * DAY_NOTE_PAD_X;
  let y = CARD_PAD + NOTES_TITLE_LINE + PART_GAP;
  const laid = notes.map((note) => {
    const pieces = roster ? notePieces(roster, note) : [{ text: note, kind: 'plain' as const }];
    const lines = wrapPieces(ctx, pieces, width, look);
    const laidNote = { top: y, lines };
    y += 2 * DAY_NOTE_PAD_Y + lines.length * DAY_NOTE_LINE + DAY_NOTE_GAP;
    return laidNote;
  });
  return { top, height: y - DAY_NOTE_GAP + CARD_PAD, notes: laid };
}

/** Breaks a Day Note into lines of words, keeping which mark each word belongs to. */
function wrapPieces(
  ctx: CanvasRenderingContext2D,
  pieces: NotePiece[],
  width: number,
  look: Look,
): NoteWord[][] {
  const lines: NoteWord[][] = [];
  let line: NoteWord[] = [];
  let x = 0;
  let spaceBefore = false;
  pieces.forEach((piece, index) => {
    const marked = piece.kind !== 'plain';
    // Split into words, remembering whether a space came before each one.
    for (const part of piece.text.split(/(\s+)/)) {
      if (part === '') continue;
      if (/^\s+$/.test(part)) {
        spaceBefore = true;
        continue;
      }
      setType(ctx, marked ? look.type.dayNoteMark : look.type.dayNote);
      const wordWidth = ctx.measureText(part).width + (marked ? 2 * MARK_PAD_X : 0);
      setType(ctx, look.type.dayNote);
      const gap = line.length > 0 && spaceBefore ? ctx.measureText(' ').width : 0;
      if (line.length > 0 && x + gap + wordWidth > width) {
        lines.push(line);
        line = [];
        x = 0;
      } else {
        x += gap;
      }
      line.push({ text: part, x, width: wordWidth, kind: piece.kind, piece: index });
      x += wordWidth;
      spaceBefore = false;
    }
  });
  if (line.length > 0) lines.push(line);
  return lines;
}

/** Names one under the other, each with its Note (if any) hanging under it. */
function stackNames(ctx: CanvasRenderingContext2D, row: ScheduleRow, look: Look) {
  const names: NameBox[] = [];
  let y = 0;
  const textWidth = CARD_INNER_WIDTH - 2 * NAME_PAD_X;

  for (const { crewMember, note, personTasks = [] } of row.who) {
    setType(ctx, look.type.personTask);
    const subLines = personTasks.flatMap((task) => wrap(ctx, task, textWidth));
    const chipHeight =
      subLines.length > 0
        ? SUBS_PAD_TOP + SUBS_NAME_LINE + subLines.length * SUB_LINE + SUBS_PAD_BOTTOM
        : NAME_HEIGHT;
    setType(ctx, look.type.note);
    const noteLines = note ? wrap(ctx, note, textWidth) : [];
    const height =
      chipHeight +
      (noteLines.length > 0 ? NOTE_PAD_TOP + noteLines.length * NOTE_LINE + NOTE_PAD_BOTTOM : 0);
    const { name, color } = crewMember;
    names.push({ name, color, subLines, chipHeight, noteLines, y, height });
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

  // A Job's Tasks are for everyone on it, as on the screen.
  const tasksHeading = 'WORK FOR THE WHOLE CREW';
  for (const card of layout.cards) drawCard(ctx, card, look, tasksHeading);
  if (layout.dayNotes) drawDayNotes(ctx, layout.dayNotes, look);
}

/** The white card behind a Job, a Standing Row or the Notes for the day. */
function drawCardGround(ctx: CanvasRenderingContext2D, top: number, height: number, look: Look) {
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
}

/** The Notes for the day: a title, then each note on the pale ground, names in yellow, Jobs in black. */
function drawDayNotes(ctx: CanvasRenderingContext2D, layout: DayNotesLayout, look: Look) {
  drawCardGround(ctx, layout.top, layout.height, look);
  ctx.fillStyle = PALETTE.ink;
  setType(ctx, look.type.dayNotesTitle);
  ctx.fillText('NOTES FOR THE DAY', CARD_INNER_X, layout.top + CARD_PAD + NOTES_TITLE_LINE / 2 + 2);

  for (const note of layout.notes) {
    const noteTop = layout.top + note.top;
    const noteHeight = 2 * DAY_NOTE_PAD_Y + note.lines.length * DAY_NOTE_LINE;
    ctx.fillStyle = PALETTE.canvas;
    ctx.beginPath();
    ctx.roundRect(CARD_INNER_X, noteTop, CARD_INNER_WIDTH, noteHeight, look.radius.chip);
    ctx.fill();

    note.lines.forEach((line, lineIndex) => {
      const middle = noteTop + DAY_NOTE_PAD_Y + (lineIndex + 0.5) * DAY_NOTE_LINE + 1;
      const left = CARD_INNER_X + DAY_NOTE_PAD_X;
      // The marks first: one for the run of words of the same piece on this line.
      line.forEach((word, wordIndex) => {
        if (word.kind === 'plain') return;
        const previous = line[wordIndex - 1];
        if (previous && previous.piece === word.piece) return;
        const run = line.slice(wordIndex);
        const end = run.findIndex((other) => other.piece !== word.piece);
        const last = run[(end === -1 ? run.length : end) - 1] ?? word;
        ctx.fillStyle = word.kind === 'job' ? PALETTE.ink : CREW_COLORS.yellow;
        ctx.beginPath();
        ctx.roundRect(left + word.x, middle - MARK_HEIGHT / 2, last.x + last.width - word.x, MARK_HEIGHT, 6);
        ctx.fill();
      });
      for (const word of line) {
        const marked = word.kind !== 'plain';
        setType(ctx, marked ? look.type.dayNoteMark : look.type.dayNote);
        ctx.fillStyle = word.kind === 'job' ? PALETTE.paper : PALETTE.ink;
        ctx.fillText(word.text, left + word.x + (marked ? MARK_PAD_X : 0), middle);
      }
    });
  }
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
  drawCardGround(ctx, top, height, look);

  const headTop = top + CARD_PAD;
  if (card.isJob) {
    // A Job: its number and count, small, then its name in large capitals.
    ctx.fillStyle = PALETTE.muted;
    setType(ctx, look.type.count);
    ctx.textAlign = 'right';
    ctx.fillText(card.countText, CARD_INNER_X + CARD_INNER_WIDTH, headTop + OVER_LINE / 2);
    ctx.textAlign = 'left';
    const countWidth = ctx.measureText(card.countText).width;
    setType(ctx, look.type.over);
    ctx.fillText(
      card.overText,
      CARD_INNER_X,
      headTop + OVER_LINE / 2,
      CARD_INNER_WIDTH - countWidth - 16,
    );
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
    ctx.fillText(card.countText, CARD_INNER_X + CARD_INNER_WIDTH, headTop + YARD_LINE / 2 + 4);
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
  const hasSubs = box.subLines.length > 0;
  const middle = hasSubs ? y + SUBS_PAD_TOP + SUBS_NAME_LINE / 2 + 1 : y + NAME_HEIGHT / 2 + 1;

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
  ctx.roundRect(x, y, width, box.chipHeight, look.radius.chip);
  ctx.fill();

  ctx.fillStyle = crewInk(box.color);
  setType(ctx, look.type.name);
  ctx.fillText(box.name, x + NAME_PAD_X, middle, width - 2 * NAME_PAD_X);

  // Their Person Tasks: smaller lines under the name, in the same chip.
  setType(ctx, look.type.personTask);
  box.subLines.forEach((line, index) =>
    ctx.fillText(
      line,
      x + NAME_PAD_X,
      y + SUBS_PAD_TOP + SUBS_NAME_LINE + (index + 0.5) * SUB_LINE,
      width - 2 * NAME_PAD_X,
    ),
  );
}

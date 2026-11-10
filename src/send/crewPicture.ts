import { CREW_COLORS, PALETTE, crewInk } from '../palette';
import { fullDate, type Color, type CrewView, type ScheduleRow } from '../schedule-rules';

/**
 * Draws the crew view as a picture (a PNG) of the Daily Schedule, made to be
 * read on a phone: the date at the top, then one block for each Job and
 * Standing Row. A block is the sheet the crew knows: where on the left (the
 * Job, large, with its Tasks under it), who on the right, one name to a line,
 * every name the same width and in its color. So a Crew Member runs an eye
 * down the one column of names to find their own, and the Job is right beside
 * it, inside the same frame. A Foreman's name carries a star; a Note hangs
 * under its name in red. It draws exactly the rows it is given and nothing
 * else: no buttons and no Not Placed list. No rule is applied here.
 *
 * Drawn by hand on a canvas rather than photographed from the screen, so it
 * is the same picture whatever the Scheduler's window looks like. It is
 * narrow with large text, to be readable in Slack on a phone, and drawn at
 * twice its size so it stays sharp.
 */
export function renderCrewPicture(view: CrewView): Promise<Blob> {
  const look = readLook();
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

// --- The look: the Scheduler's screen, drawn by hand ------------------------
// Colors are the palette. The type family, the weights, the letter-spacings,
// the corners and the Foreman's star are the shared look's (the tokens in
// src/look.css), read off the page, so the picture and the screen cannot
// drift apart. Sizes are the picture's own: it is looked at on a phone, at
// under half its width, so they are large.

const WIDTH = 780;
const SHARPNESS = 2;
const MARGIN = 24;

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

/** The shared look as the picture uses it: its kinds of text, its corners and its star. */
interface Look {
  type: Record<'date' | 'updated' | 'updatedNote' | 'job' | 'task' | 'name' | 'note', Type>;
  /** Corner radii, in the picture's pixels. */
  radius: { card: number; control: number; chip: number };
  /** The Foreman's star: its corners, each from 0 to 1 across and down a square. */
  star: [x: number, y: number][];
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

  const family = token('--font');
  const type = (weight: string, size: number, tracking?: string): Type => ({
    font: `${number(`--weight-${weight}`)} ${size}px ${family}`,
    letterSpacing: `${(tracking ? number(`--tracking-${tracking}`) : 0) * size}px`,
  });
  const corner = (name: string): number => Math.round(number(`--radius-${name}`) * REM);

  // The same two weights as the screen: strong for what is looked for (the
  // date, the Job, the names, a Note), body for what is then read (the Tasks).
  return {
    type: {
      date: type('strong', 46, 'heading'),
      updated: type('strong', 34, 'label'),
      updatedNote: type('strong', 25),
      job: type('strong', 38, 'heading'),
      task: type('body', 28),
      name: type('strong', 30, 'name'),
      note: type('strong', 27),
    },
    radius: { card: corner('card'), control: corner('control'), chip: corner('chip') },
    star: [...token('--shape-star').matchAll(/([\d.]+)%\s+([\d.]+)%/g)].map(
      ([, x, y]): [number, number] => [Number(x) / 100, Number(y) / 100],
    ),
  };
}

/** Sets the type to draw or measure with. */
function setType(ctx: CanvasRenderingContext2D, { font, letterSpacing }: Type) {
  ctx.font = font;
  ctx.letterSpacing = letterSpacing;
}

const UPDATED_HEIGHT = 72;
const UPDATED_GAP = 16;
const UPDATED_PAD_X = 20;
const DATE_HEIGHT = 84;

/** A block: one Job or Standing Row, in a frame that survives being shown small. */
const BLOCK_WIDTH = WIDTH - 2 * MARGIN;
const BLOCK_GAP = 14;
const FRAME = 3;
const BLOCK_PAD_Y = 16;
const BLOCK_PAD_LEFT = 22;
const BLOCK_PAD_RIGHT = 16;

/** Who: one column of names, every one this wide. */
const NAME_WIDTH = 344;
const NAME_HEIGHT = 56;
const NAME_GAP = 6;
const NAME_PAD_X = 18;
const STAR = 25;
const NOTE_LINE = 34;
const NOTE_PAD_TOP = 6;
const NOTE_PAD_BOTTOM = 8;
const NAMES_X = MARGIN + BLOCK_WIDTH - BLOCK_PAD_RIGHT - NAME_WIDTH;

/** Where: the Job and its Tasks, to the left of the names. */
const WHERE_X = MARGIN + BLOCK_PAD_LEFT;
const WHERE_WIDTH = NAMES_X - 20 - WHERE_X;
const JOB_LINE = 44;
const TASKS_GAP = 6;
const TASK_LINE = 36;
/** How far the rest of a Task too long for one line is set in, so two Tasks never read as three. */
const TASK_INDENT = 20;

// --- Working out where everything goes --------------------------------------

/** One name in the column of names, with its Note under it. `y` is from the top of the column. */
interface NameBox {
  name: string;
  color: Color;
  foreman: boolean;
  noteLines: string[];
  y: number;
  height: number;
}

/** One line of a Task: the first line of it, or the rest of one too long for a line. */
interface TaskLine {
  text: string;
  rest: boolean;
}

interface BlockLayout {
  row: ScheduleRow;
  top: number;
  height: number;
  jobLines: string[];
  taskLines: TaskLine[];
  names: NameBox[];
}

interface Layout {
  dateTop: number;
  blocks: BlockLayout[];
  height: number;
}

function layOut(view: CrewView, ctx: CanvasRenderingContext2D, look: Look): Layout {
  const dateTop = MARGIN + (view.updated ? UPDATED_HEIGHT + UPDATED_GAP : 0);

  let top = dateTop + DATE_HEIGHT;
  const blocks = view.rows.map((row): BlockLayout => {
    setType(ctx, look.type.job);
    const jobLines = wrap(ctx, row.label, WHERE_WIDTH);
    setType(ctx, look.type.task);
    const taskLines = row.tasks.flatMap((task) =>
      wrap(ctx, task, WHERE_WIDTH - TASK_INDENT).map((text, index) => ({ text, rest: index > 0 })),
    );
    const { names, height: namesHeight } = stackNames(ctx, row, look);

    const whereHeight =
      jobTop(0) +
      jobLines.length * JOB_LINE +
      (taskLines.length > 0 ? TASKS_GAP + taskLines.length * TASK_LINE : 0);
    const height = Math.max(whereHeight, namesHeight) + 2 * BLOCK_PAD_Y;
    const block = { row, top, height, jobLines, taskLines, names };
    top += height + BLOCK_GAP;
    return block;
  });

  return { dateTop, blocks, height: top - BLOCK_GAP + MARGIN };
}

/** The top of the Job's first line, which sits level with the first name beside it. */
const jobTop = (blockTop: number): number => blockTop + (NAME_HEIGHT - JOB_LINE) / 2;

/** Names one under the other, each with its Note (if any) hanging under it. */
function stackNames(ctx: CanvasRenderingContext2D, row: ScheduleRow, look: Look) {
  setType(ctx, look.type.note);
  const names: NameBox[] = [];
  let y = 0;

  for (const { crewMember, note } of row.who) {
    const noteLines = note ? wrap(ctx, note, NAME_WIDTH - 2 * NAME_PAD_X) : [];
    const height =
      NAME_HEIGHT +
      (noteLines.length > 0 ? NOTE_PAD_TOP + noteLines.length * NOTE_LINE + NOTE_PAD_BOTTOM : 0);
    const { name, color, foreman } = crewMember;
    names.push({ name, color, foreman, noteLines, y, height });
    y += height + NAME_GAP;
  }

  return { names, height: y - NAME_GAP };
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
  // White all over: it reads the same in Slack's light and dark themes.
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, WIDTH, layout.height);
  ctx.textBaseline = 'middle';

  if (view.updated) drawUpdated(ctx, look);

  ctx.fillStyle = PALETTE.ink;
  setType(ctx, look.type.date);
  ctx.fillText(fullDate(view.date), MARGIN + 2, layout.dateTop + DATE_HEIGHT / 2 - 6, BLOCK_WIDTH - 4);

  for (const block of layout.blocks) drawBlock(ctx, block, look);
}

/** The UPDATED marker: a solid bar of the alert red across the top. */
function drawUpdated(ctx: CanvasRenderingContext2D, look: Look) {
  const middle = MARGIN + UPDATED_HEIGHT / 2 + 2;
  ctx.fillStyle = PALETTE.alert;
  ctx.beginPath();
  ctx.roundRect(MARGIN, MARGIN, BLOCK_WIDTH, UPDATED_HEIGHT, look.radius.control);
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
    MARGIN + BLOCK_WIDTH - UPDATED_PAD_X - afterWord,
  );
}

function drawBlock(ctx: CanvasRenderingContext2D, block: BlockLayout, look: Look) {
  const { row, top, height } = block;
  const inside = top + BLOCK_PAD_Y;

  // The frame, drawn wholly inside the block's edge: white for a Job, tinted for a Standing Row.
  ctx.beginPath();
  ctx.roundRect(
    MARGIN + FRAME / 2,
    top + FRAME / 2,
    BLOCK_WIDTH - FRAME,
    height - FRAME,
    look.radius.card,
  );
  if (row.destination.kind === 'standing-row') {
    ctx.fillStyle = PALETTE.standing;
    ctx.fill();
  }
  ctx.strokeStyle = PALETTE.frameLine;
  ctx.lineWidth = FRAME;
  ctx.stroke();

  // Where: the Job, then its Tasks.
  ctx.fillStyle = PALETTE.ink;
  setType(ctx, look.type.job);
  block.jobLines.forEach((line, index) =>
    ctx.fillText(line, WHERE_X, jobTop(inside) + (index + 0.5) * JOB_LINE + 1, WHERE_WIDTH),
  );
  setType(ctx, look.type.task);
  const tasksTop = jobTop(inside) + block.jobLines.length * JOB_LINE + TASKS_GAP;
  block.taskLines.forEach(({ text, rest }, index) => {
    const indent = rest ? TASK_INDENT : 0;
    ctx.fillText(
      text,
      WHERE_X + indent,
      tasksTop + (index + 0.5) * TASK_LINE + 1,
      WHERE_WIDTH - indent,
    );
  });

  // Who: the column of names.
  for (const box of block.names) drawName(ctx, box, NAMES_X, inside + box.y, look);
}

function drawName(ctx: CanvasRenderingContext2D, box: NameBox, x: number, y: number, look: Look) {
  const middle = y + NAME_HEIGHT / 2 + 1;

  // A Note hangs under its name, in one red-tinted piece with it.
  if (box.noteLines.length > 0) {
    ctx.fillStyle = PALETTE.alertWashStrong;
    ctx.beginPath();
    ctx.roundRect(x, y, NAME_WIDTH, box.height, look.radius.chip);
    ctx.fill();
    ctx.fillStyle = PALETTE.alert;
    setType(ctx, look.type.note);
    const notesTop = y + NAME_HEIGHT + NOTE_PAD_TOP;
    box.noteLines.forEach((line, index) =>
      ctx.fillText(
        line,
        x + NAME_PAD_X,
        notesTop + (index + 0.5) * NOTE_LINE + 1,
        NAME_WIDTH - 2 * NAME_PAD_X,
      ),
    );
  }

  // The name: a cell of the Crew Member's color, with the fine edge it has on the screen.
  ctx.fillStyle = CREW_COLORS[box.color];
  ctx.beginPath();
  ctx.roundRect(x, y, NAME_WIDTH, NAME_HEIGHT, look.radius.chip);
  ctx.fill();
  ctx.strokeStyle = PALETTE.nameBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, NAME_WIDTH - 2, NAME_HEIGHT - 2, look.radius.chip - 1);
  ctx.stroke();

  ctx.fillStyle = crewInk(box.color);
  setType(ctx, look.type.name);
  const starRoom = box.foreman ? STAR + 12 : 0;
  ctx.fillText(box.name, x + NAME_PAD_X, middle, NAME_WIDTH - 2 * NAME_PAD_X - starRoom);

  // A Foreman: the look's star at the end of the name, in the name's own ink.
  if (box.foreman) {
    const left = x + NAME_WIDTH - NAME_PAD_X - STAR;
    const starTop = y + (NAME_HEIGHT - STAR) / 2;
    ctx.beginPath();
    look.star.forEach(([across, down], index) => {
      const point: [number, number] = [left + across * STAR, starTop + down * STAR];
      if (index === 0) ctx.moveTo(...point);
      else ctx.lineTo(...point);
    });
    ctx.closePath();
    ctx.fill();
  }
}

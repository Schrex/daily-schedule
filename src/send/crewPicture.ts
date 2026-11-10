import { CREW_COLORS, PALETTE, crewInk } from '../palette';
import { fullDate, type Color, type CrewView, type ScheduleRow } from '../schedule-rules';

/**
 * Draws the crew view as a picture (a PNG) of the Daily Schedule: the date at
 * the top, then the JOB / TASKS / WHO schedule the crew knows, in the look of
 * the Scheduler's screen: the same type, names as pills in their colors,
 * Notes in red, hairlines between the rows. It draws exactly the rows it is
 * given and nothing else: no buttons and no Not Placed list. No rule is
 * applied here.
 *
 * Drawn by hand on a canvas rather than photographed from the screen, so it
 * is the same picture whatever the Scheduler's window looks like. It is
 * narrow with large text, to be readable in Slack on a phone, and drawn at
 * twice its size so it stays sharp.
 */
export function renderCrewPicture(view: CrewView): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const measure = canvas.getContext('2d')!;
  const layout = layOut(view, measure);

  // Sizing the canvas resets its context, so size first, then draw.
  canvas.width = WIDTH * SHARPNESS;
  canvas.height = layout.height * SHARPNESS;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SHARPNESS, SHARPNESS);
  draw(ctx, view, layout);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not draw the picture'))),
      'image/png',
    );
  });
}

// --- The look: the Scheduler's screen, drawn by hand ------------------------
// Colors are the palette. The type family is the shared look's (`--font` in
// src/look.css), read off the page so the picture and the screen cannot drift
// apart. Sizes are the picture's own: it is looked at small, so they are large.

const WIDTH = 1000;
const SHARPNESS = 2;
const MARGIN = 32;

/** The screen's type family. The fallback is for a page without the look. */
const fontFamily = (): string =>
  getComputedStyle(document.documentElement).getPropertyValue('--font').trim() ||
  'system-ui, sans-serif';

/** The look's weights and letter-spacings (in em), as the screen uses them. */
const WEIGHT = { body: 400, strong: 600, heading: 700 };
const TRACKING = { heading: -0.022, name: -0.01, label: 0.08 };

interface Type {
  weight: number;
  size: number;
  tracking?: number;
}

const DATE_TYPE: Type = { weight: WEIGHT.heading, size: 48, tracking: TRACKING.heading };
const UPDATED_TYPE: Type = { weight: WEIGHT.heading, size: 34, tracking: TRACKING.label };
const UPDATED_NOTE_TYPE: Type = { weight: WEIGHT.strong, size: 25 };
const HEADER_TYPE: Type = { weight: WEIGHT.strong, size: 22, tracking: TRACKING.label };
const JOB_TYPE: Type = { weight: WEIGHT.heading, size: 29, tracking: TRACKING.name };
const TASK_TYPE: Type = { weight: WEIGHT.body, size: 26 };
const NAME_TYPE: Type = { weight: WEIGHT.strong, size: 27, tracking: TRACKING.name };
const NOTE_TYPE: Type = { weight: WEIGHT.heading, size: 26 };

/** Sets the type to draw or measure with. */
function setType(ctx: CanvasRenderingContext2D, { weight, size, tracking = 0 }: Type) {
  ctx.font = `${weight} ${size}px ${fontFamily()}`;
  ctx.letterSpacing = `${tracking * size}px`;
}

const UPDATED_HEIGHT = 68;
const UPDATED_GAP = 20;
const DATE_HEIGHT = 88;
const HEADER_HEIGHT = 54;
const CARD_RADIUS = 20;
const CONTROL_RADIUS = 14;
const HAIRLINE = 2; // a hairline that survives being shown at a third of its size
const CELL_PAD_X = 16;
const CELL_PAD_Y = 16;
const JOB_LINE = 36;
const TASK_LINE = 34;
const NAME_HEIGHT = 48;
const NAME_PAD_X = 16;
const NAME_GAP_X = 12;
const NAME_GAP_Y = 10;
const NOTE_GAP = 12;

const TABLE_WIDTH = WIDTH - 2 * MARGIN;
const JOB_WIDTH = Math.round(TABLE_WIDTH * 0.27);
const TASKS_WIDTH = Math.round(TABLE_WIDTH * 0.282);
const WHO_WIDTH = TABLE_WIDTH - JOB_WIDTH - TASKS_WIDTH;
const JOB_X = MARGIN;
const TASKS_X = JOB_X + JOB_WIDTH;
const WHO_X = TASKS_X + TASKS_WIDTH;

// --- Working out where everything goes --------------------------------------

/** One name, with its Note beside it, placed inside the WHO cell. */
interface NameBox {
  name: string;
  color: Color;
  note?: string;
  x: number;
  y: number;
  nameWidth: number;
}

interface RowLayout {
  row: ScheduleRow;
  top: number;
  height: number;
  jobLines: string[];
  taskLines: string[];
  names: NameBox[];
  namesHeight: number;
}

interface Layout {
  dateTop: number;
  headerTop: number;
  rows: RowLayout[];
  tableBottom: number;
  height: number;
}

function layOut(view: CrewView, ctx: CanvasRenderingContext2D): Layout {
  const dateTop = MARGIN + (view.updated ? UPDATED_HEIGHT + UPDATED_GAP : 0);
  const headerTop = dateTop + DATE_HEIGHT;

  let top = headerTop + HEADER_HEIGHT;
  const rows = view.rows.map((row): RowLayout => {
    setType(ctx, JOB_TYPE);
    const jobLines = wrap(ctx, row.label, JOB_WIDTH - 2 * CELL_PAD_X);
    setType(ctx, TASK_TYPE);
    const taskLines = row.tasks.flatMap((task) => wrap(ctx, task, TASKS_WIDTH - 2 * CELL_PAD_X));
    const { names, height: namesHeight } = flowNames(ctx, row);

    const height =
      Math.max(jobLines.length * JOB_LINE, taskLines.length * TASK_LINE, namesHeight) +
      2 * CELL_PAD_Y;
    const laidOut = { row, top, height, jobLines, taskLines, names, namesHeight };
    top += height;
    return laidOut;
  });

  return { dateTop, headerTop, rows, tableBottom: top, height: top + MARGIN };
}

/** Names flow left to right and wrap, each kept together with its Note. */
function flowNames(ctx: CanvasRenderingContext2D, row: ScheduleRow) {
  const available = WHO_WIDTH - 2 * CELL_PAD_X;
  const names: NameBox[] = [];
  let x = 0;
  let y = 0;

  for (const { crewMember, note } of row.who) {
    setType(ctx, NAME_TYPE);
    const nameWidth = Math.ceil(ctx.measureText(crewMember.name).width) + 2 * NAME_PAD_X;
    setType(ctx, NOTE_TYPE);
    const width = nameWidth + (note ? NOTE_GAP + Math.ceil(ctx.measureText(note).width) : 0);

    if (x > 0 && x + width > available) {
      x = 0;
      y += NAME_HEIGHT + NAME_GAP_Y;
    }
    names.push({ name: crewMember.name, color: crewMember.color, note, x, y, nameWidth });
    x += width + NAME_GAP_X;
  }

  return { names, height: y + NAME_HEIGHT };
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

function draw(ctx: CanvasRenderingContext2D, view: CrewView, layout: Layout) {
  // White all over: it reads the same in Slack's light and dark themes.
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, WIDTH, layout.height);
  ctx.textBaseline = 'middle';

  if (view.updated) drawUpdated(ctx);

  ctx.fillStyle = PALETTE.ink;
  setType(ctx, DATE_TYPE);
  ctx.fillText(fullDate(view.date), MARGIN, layout.dateTop + DATE_HEIGHT / 2 - 8, TABLE_WIDTH);

  // The schedule is one card, as on the screen: everything inside is clipped
  // to its rounded corners.
  const cardHeight = layout.tableBottom - layout.headerTop;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(MARGIN, layout.headerTop, TABLE_WIDTH, cardHeight, CARD_RADIUS);
  ctx.clip();

  // Header: JOB / TASKS / WHO, quiet labels.
  ctx.fillStyle = PALETTE.muted;
  setType(ctx, HEADER_TYPE);
  const headerMiddle = layout.headerTop + HEADER_HEIGHT / 2 + 2;
  ctx.fillText('JOB', JOB_X + CELL_PAD_X, headerMiddle);
  ctx.fillText('TASKS', TASKS_X + CELL_PAD_X, headerMiddle);
  ctx.fillText('WHO', WHO_X + CELL_PAD_X, headerMiddle);

  for (const rowLayout of layout.rows) drawRow(ctx, rowLayout);

  // Hairlines between the rows, drawn last so they sit on the row backgrounds:
  // firmer under the header and where the Jobs end.
  layout.rows.forEach(({ row, top }, index) => {
    const before = layout.rows[index - 1]?.row;
    const firm =
      !before || (row.destination.kind === 'standing-row' && before.destination.kind === 'job');
    ctx.fillStyle = firm ? PALETTE.lineStrong : PALETTE.line;
    ctx.fillRect(MARGIN, top - HAIRLINE / 2, TABLE_WIDTH, HAIRLINE);
  });
  ctx.restore();

  // The edge of the card.
  ctx.strokeStyle = PALETTE.lineStrong;
  ctx.lineWidth = HAIRLINE;
  ctx.beginPath();
  ctx.roundRect(MARGIN, layout.headerTop, TABLE_WIDTH, cardHeight, CARD_RADIUS);
  ctx.stroke();
}

/** The UPDATED marker: a solid bar of the alert red across the top. */
function drawUpdated(ctx: CanvasRenderingContext2D) {
  const middle = MARGIN + UPDATED_HEIGHT / 2 + 2;
  ctx.fillStyle = PALETTE.alert;
  ctx.beginPath();
  ctx.roundRect(MARGIN, MARGIN, TABLE_WIDTH, UPDATED_HEIGHT, CONTROL_RADIUS);
  ctx.fill();

  ctx.fillStyle = PALETTE.paper;
  setType(ctx, UPDATED_TYPE);
  ctx.fillText('UPDATED', MARGIN + CELL_PAD_X, middle);
  const afterWord = MARGIN + CELL_PAD_X + ctx.measureText('UPDATED').width + 20;
  setType(ctx, UPDATED_NOTE_TYPE);
  ctx.fillText('This replaces the earlier schedule', afterWord, middle);
}

function drawRow(ctx: CanvasRenderingContext2D, layout: RowLayout) {
  const { row, top, height } = layout;
  const middle = top + height / 2;

  if (row.destination.kind === 'standing-row') {
    ctx.fillStyle = PALETTE.standing;
    ctx.fillRect(MARGIN, top, TABLE_WIDTH, height);
  }

  ctx.fillStyle = PALETTE.ink;
  setType(ctx, JOB_TYPE);
  drawLines(ctx, layout.jobLines, JOB_X + CELL_PAD_X, middle, JOB_LINE);
  setType(ctx, TASK_TYPE);
  drawLines(ctx, layout.taskLines, TASKS_X + CELL_PAD_X, middle, TASK_LINE);

  const namesLeft = WHO_X + CELL_PAD_X;
  const namesTop = middle - layout.namesHeight / 2;
  for (const box of layout.names) {
    const x = namesLeft + box.x;
    const y = namesTop + box.y;

    // The name: a pill in the Crew Member's color, with the fine edge it has
    // on the screen.
    ctx.fillStyle = CREW_COLORS[box.color];
    ctx.beginPath();
    ctx.roundRect(x, y, box.nameWidth, NAME_HEIGHT, NAME_HEIGHT / 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.nameBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, box.nameWidth - 1, NAME_HEIGHT - 1, NAME_HEIGHT / 2);
    ctx.stroke();

    ctx.fillStyle = crewInk(box.color);
    setType(ctx, NAME_TYPE);
    ctx.fillText(box.name, x + NAME_PAD_X, y + NAME_HEIGHT / 2 + 1);

    if (box.note) {
      ctx.fillStyle = PALETTE.alert;
      setType(ctx, NOTE_TYPE);
      ctx.fillText(box.note, x + box.nameWidth + NOTE_GAP, y + NAME_HEIGHT / 2 + 1);
    }
  }
}

/** Draws lines of text as one block centered on `middle`. */
function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  middle: number,
  lineHeight: number,
) {
  const first = middle - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => ctx.fillText(line, x, first + index * lineHeight + 1));
}

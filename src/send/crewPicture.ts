import { fullDate, type Color, type CrewView, type ScheduleRow } from '../schedule-rules';

/**
 * Draws the crew view as a picture (a PNG) of the Daily Schedule: the date at
 * the top, then the JOB / TASKS / WHO grid the crew knows, names in their
 * colors and Notes in red. It draws exactly the rows it is given and nothing
 * else: no buttons and no Not Placed list. No rule is applied here.
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

// --- The look: keep in step with screen.css ---------------------------------

const WIDTH = 1000;
const SHARPNESS = 2;
const MARGIN = 28;
const FONT_FAMILY = "Calibri, 'Segoe UI', Arial, Helvetica, sans-serif";

const font = (weight: number, size: number) => `${weight} ${size}px ${FONT_FAMILY}`;
const DATE_FONT = font(700, 46);
const UPDATED_FONT = font(800, 34);
const HEADER_FONT = font(700, 26);
const JOB_FONT = font(700, 30);
const TASK_FONT = font(400, 27);
const NAME_FONT = font(600, 28);
const NOTE_FONT = font(700, 27);

const INK = '#111111';
const GRID = '#1f1f1f';
const HEADER_BG = '#1f3864';
const STANDING_BG = '#f1f1f1';
const NOTE_RED = '#d00000';
const NAME_BG: Record<Color, string> = {
  grey: '#bfbfbf',
  blue: '#9dc3e6',
  orange: '#f4b183',
  yellow: '#ffe066',
  red: '#e03131',
};
const nameInk = (color: Color) => (color === 'red' ? '#ffffff' : INK);

const UPDATED_HEIGHT = 64;
const DATE_HEIGHT = 84;
const HEADER_HEIGHT = 52;
const CELL_PAD_X = 16;
const CELL_PAD_Y = 14;
const JOB_LINE = 36;
const TASK_LINE = 34;
const NAME_HEIGHT = 46;
const NAME_PAD_X = 14;
const NAME_GAP_X = 14;
const NAME_GAP_Y = 10;
const NOTE_GAP = 10;

const TABLE_WIDTH = WIDTH - 2 * MARGIN;
const JOB_WIDTH = Math.round(TABLE_WIDTH * 0.24);
const TASKS_WIDTH = Math.round(TABLE_WIDTH * 0.3);
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
  const dateTop = MARGIN + (view.updated ? UPDATED_HEIGHT + 14 : 0);
  const headerTop = dateTop + DATE_HEIGHT;

  let top = headerTop + HEADER_HEIGHT;
  const rows = view.rows.map((row): RowLayout => {
    ctx.font = JOB_FONT;
    const jobLines = wrap(ctx, row.label, JOB_WIDTH - 2 * CELL_PAD_X);
    ctx.font = TASK_FONT;
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
    ctx.font = NAME_FONT;
    const nameWidth = Math.ceil(ctx.measureText(crewMember.name).width) + 2 * NAME_PAD_X;
    ctx.font = NOTE_FONT;
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
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, layout.height);
  ctx.textBaseline = 'middle';

  if (view.updated) {
    ctx.fillStyle = NOTE_RED;
    ctx.fillRect(MARGIN, MARGIN, TABLE_WIDTH, UPDATED_HEIGHT);
    ctx.fillStyle = '#ffffff';
    ctx.font = UPDATED_FONT;
    ctx.fillText('UPDATED', MARGIN + CELL_PAD_X, MARGIN + UPDATED_HEIGHT / 2 + 2);
    const afterWord = MARGIN + CELL_PAD_X + ctx.measureText('UPDATED').width + 18;
    ctx.font = font(600, 26);
    ctx.fillText('This replaces the earlier schedule', afterWord, MARGIN + UPDATED_HEIGHT / 2 + 2);
  }

  ctx.fillStyle = INK;
  ctx.font = DATE_FONT;
  ctx.fillText(fullDate(view.date), MARGIN, layout.dateTop + DATE_HEIGHT / 2 - 6, TABLE_WIDTH);

  // Header: JOB / TASKS / WHO
  ctx.fillStyle = HEADER_BG;
  ctx.fillRect(MARGIN, layout.headerTop, TABLE_WIDTH, HEADER_HEIGHT);
  ctx.fillStyle = '#ffffff';
  ctx.font = HEADER_FONT;
  const headerMiddle = layout.headerTop + HEADER_HEIGHT / 2 + 1;
  ctx.fillText('JOB', JOB_X + CELL_PAD_X, headerMiddle);
  ctx.fillText('TASKS', TASKS_X + CELL_PAD_X, headerMiddle);
  ctx.fillText('WHO', WHO_X + CELL_PAD_X, headerMiddle);

  for (const rowLayout of layout.rows) drawRow(ctx, rowLayout);

  // The ruled grid, drawn last so it sits on top of the cell backgrounds.
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const { top } of layout.rows) {
    ctx.moveTo(MARGIN, top);
    ctx.lineTo(MARGIN + TABLE_WIDTH, top);
  }
  for (const x of [TASKS_X, WHO_X]) {
    ctx.moveTo(x, layout.headerTop);
    ctx.lineTo(x, layout.tableBottom);
  }
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeRect(MARGIN, layout.headerTop, TABLE_WIDTH, layout.tableBottom - layout.headerTop);
}

function drawRow(ctx: CanvasRenderingContext2D, layout: RowLayout) {
  const { row, top, height } = layout;
  const middle = top + height / 2;

  if (row.destination.kind === 'standing-row') {
    ctx.fillStyle = STANDING_BG;
    ctx.fillRect(MARGIN, top, TABLE_WIDTH, height);
  }

  ctx.fillStyle = INK;
  ctx.font = JOB_FONT;
  drawLines(ctx, layout.jobLines, JOB_X + CELL_PAD_X, middle, JOB_LINE);
  ctx.font = TASK_FONT;
  drawLines(ctx, layout.taskLines, TASKS_X + CELL_PAD_X, middle, TASK_LINE);

  const namesLeft = WHO_X + CELL_PAD_X;
  const namesTop = middle - layout.namesHeight / 2;
  for (const box of layout.names) {
    const x = namesLeft + box.x;
    const y = namesTop + box.y;

    ctx.fillStyle = NAME_BG[box.color];
    ctx.fillRect(x, y, box.nameWidth, NAME_HEIGHT);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, box.nameWidth - 1, NAME_HEIGHT - 1);

    ctx.fillStyle = nameInk(box.color);
    ctx.font = NAME_FONT;
    ctx.fillText(box.name, x + NAME_PAD_X, y + NAME_HEIGHT / 2 + 1);

    if (box.note) {
      ctx.fillStyle = NOTE_RED;
      ctx.font = NOTE_FONT;
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

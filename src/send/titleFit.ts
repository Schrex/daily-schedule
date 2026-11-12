/**
 * How a card's title fits the room beside its Job number and count, in one
 * rule for every name: on one line at full size if it fits; otherwise smaller
 * until it fits on one line, but never under `floor` of its size; only a name
 * too long for that wraps, made smaller just enough for its widest word (and
 * again never under `floor`). Widths are measured at full size.
 */
export function titleFit({
  title,
  widestWord,
  room,
  floor,
}: {
  title: number;
  widestWord: number;
  room: number;
  floor: number;
}): { scale: number; oneLine: boolean } {
  if (title <= room) return { scale: 1, oneLine: true };
  const oneLine = room / title;
  if (oneLine >= floor) return { scale: oneLine, oneLine: true };
  return { scale: widestWord <= room ? 1 : Math.max(floor, room / widestWord), oneLine: false };
}

/**
 * Where a Job card's title and number go. The number stays beside the title
 * when the title fits there on one line (made smaller if need be, as
 * `titleFit`). When it does not, but would on a line to itself (beside the
 * count only), the number goes on a small line under the title instead, so the
 * title keeps one line. Only a title too long even for that wraps, with the
 * number beside its last line. `beside` is the room left by the number and
 * count, `alone` the room left by the count only.
 */
export function titlePlace({
  title,
  widestWord,
  beside,
  alone,
  floor,
  hasNumber,
}: {
  title: number;
  widestWord: number;
  beside: number;
  alone: number;
  floor: number;
  hasNumber: boolean;
}): { scale: number; oneLine: boolean; numberBelow: boolean } {
  const there = titleFit({ title, widestWord, room: beside, floor });
  if (there.oneLine || !hasNumber) return { ...there, numberBelow: false };
  const under = titleFit({ title, widestWord, room: alone, floor });
  if (under.oneLine) return { ...under, numberBelow: true };
  return { ...there, numberBelow: false };
}

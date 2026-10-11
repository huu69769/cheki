/**
 * 元に戻す／やり直し。
 * 指でドラッグしている間やスライダーを動かしている間の細かい変更は、
 * 同じ mergeKey を付けることで1回分の操作にまとめる。
 */

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
  /** 直前の変更のまとめ用キーと時刻 */
  lastKey: string | null;
  lastTime: number;
}

export const HISTORY_LIMIT = 80;
/** 同じ mergeKey の変更をまとめる時間（ミリ秒） */
export const MERGE_WINDOW_MS = 1200;

export function createHistory<T>(present: T): HistoryState<T> {
  return { past: [], present, future: [], lastKey: null, lastTime: 0 };
}

export function pushHistory<T>(h: HistoryState<T>, next: T, mergeKey: string | null, now: number): HistoryState<T> {
  if (Object.is(next, h.present)) return h;
  const merge = mergeKey !== null && mergeKey === h.lastKey && now - h.lastTime < MERGE_WINDOW_MS;
  if (merge) {
    return { ...h, present: next, future: [], lastTime: now };
  }
  const past = [...h.past, h.present];
  if (past.length > HISTORY_LIMIT) past.shift();
  return { past, present: next, future: [], lastKey: mergeKey, lastTime: now };
}

export function undoHistory<T>(h: HistoryState<T>): HistoryState<T> {
  if (!h.past.length) return h;
  const prev = h.past[h.past.length - 1];
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future], lastKey: null, lastTime: 0 };
}

export function redoHistory<T>(h: HistoryState<T>): HistoryState<T> {
  if (!h.future.length) return h;
  const [next, ...rest] = h.future;
  return { past: [...h.past, h.present], present: next, future: rest, lastKey: null, lastTime: 0 };
}

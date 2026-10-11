import type { DateFormatId } from '../model/types';

/**
 * フィルムカメラの日付写し込み風の「7セグメント数字」をコードで描く（フォント不要）。
 */

// a b c d e f g の順
const DIGITS: Record<string, number[]> = {
  '0': [1, 1, 1, 1, 1, 1, 0],
  '1': [0, 1, 1, 0, 0, 0, 0],
  '2': [1, 1, 0, 1, 1, 0, 1],
  '3': [1, 1, 1, 1, 0, 0, 1],
  '4': [0, 1, 1, 0, 0, 1, 1],
  '5': [1, 0, 1, 1, 0, 1, 1],
  '6': [1, 0, 1, 1, 1, 1, 1],
  '7': [1, 1, 1, 0, 0, 1, 0],
  '8': [1, 1, 1, 1, 1, 1, 1],
  '9': [1, 1, 1, 1, 0, 1, 1],
};

export function formatDateStamp(date: string, format: DateFormatId): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const [yyyy, mm, dd] = m ? [m[1], m[2], m[3]] : ['2000', '01', '01'];
  const yy = yyyy.slice(2);
  switch (format) {
    case 'yyyy-mm-dd':
      return `${yyyy} ${mm} ${dd}`;
    case 'mm-dd-yy':
      return `${mm} ${dd} '${yy}`;
    case 'dd-mm-yy':
      return `${dd} ${mm} '${yy}`;
    case 'yy-mm-dd':
    default:
      return `'${yy} ${mm} ${dd}`;
  }
}

interface Metrics {
  digitW: number;
  gap: number;
  space: number;
  quote: number;
}

function metrics(h: number): Metrics {
  return { digitW: h * 0.52, gap: h * 0.16, space: h * 0.42, quote: h * 0.2 };
}

/** 文字列の幅（高さ h のとき） */
export function measureDateStamp(text: string, h: number): number {
  const m = metrics(h);
  let w = 0;
  for (const ch of text) {
    if (ch === ' ') w += m.space;
    else if (ch === "'") w += m.quote + m.gap;
    else w += m.digitW + m.gap;
  }
  return Math.max(0, w - m.gap);
}

function segment(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, t: number) {
  // 両端がとがった六角形のセグメント
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy * (t / 2);
  const ny = ux * (t / 2);
  const inset = t / 2;
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 + ux * inset + nx, y1 + uy * inset + ny);
  ctx.lineTo(x2 - ux * inset + nx, y2 - uy * inset + ny);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2 - ux * inset - nx, y2 - uy * inset - ny);
  ctx.lineTo(x1 + ux * inset - nx, y1 + uy * inset - ny);
  ctx.closePath();
}

function digitPath(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, h: number) {
  const segs = DIGITS[ch];
  if (!segs) return;
  const w = h * 0.52;
  const t = h * 0.13;
  const g = t * 0.28; // セグメントのすき間
  const skew = h * 0.08; // 少し斜体
  const sx = (px: number, py: number): [number, number] => [x + px + skew * (1 - (py - y) / h), py];
  const top = y;
  const mid = y + h / 2;
  const bot = y + h;
  const L = t / 2;
  const R = w - t / 2;
  const pts: Array<[[number, number], [number, number]]> = [
    [sx(L + g, top + t / 2), sx(R - g, top + t / 2)], // a
    [sx(R, top + t / 2 + g), sx(R, mid - g)], // b
    [sx(R, mid + g), sx(R, bot - t / 2 - g)], // c
    [sx(L + g, bot - t / 2), sx(R - g, bot - t / 2)], // d
    [sx(L, mid + g), sx(L, bot - t / 2 - g)], // e
    [sx(L, top + t / 2 + g), sx(L, mid - g)], // f
    [sx(L + g, mid), sx(R - g, mid)], // g
  ];
  segs.forEach((on, i) => {
    if (!on) return;
    const [[x1, y1], [x2, y2]] = pts[i];
    segment(ctx, x1, y1, x2, y2, t);
  });
}

/**
 * (x, y) を右下の基準点として描く（align で左寄せも可）。
 * pxPerUnit は影のぼかし量の換算用（shadowBlur は座標変換の影響を受けないため）。
 */
export function drawDateStamp(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  h: number,
  color: string,
  align: 'left' | 'right',
  pxPerUnit: number,
) {
  const m = metrics(h);
  const total = measureDateStamp(text, h);
  let cx = align === 'right' ? x - total : x;
  const top = y - h;
  ctx.save();
  ctx.beginPath();
  for (const ch of text) {
    if (ch === ' ') {
      cx += m.space;
    } else if (ch === "'") {
      const qw = h * 0.09;
      ctx.moveTo(cx + m.quote * 0.5 + qw, top);
      ctx.lineTo(cx + m.quote * 0.5 + qw * 1.6, top);
      ctx.lineTo(cx + m.quote * 0.5, top + h * 0.3);
      ctx.lineTo(cx + m.quote * 0.5 - qw * 0.4, top + h * 0.3);
      ctx.closePath();
      cx += m.quote + m.gap;
    } else {
      digitPath(ctx, ch, cx, top, h);
      cx += m.digitW + m.gap;
    }
  }
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  // にじみ（光っている感じ）：明るくする合成で重ねる
  ctx.globalCompositeOperation = 'screen';
  ctx.shadowBlur = h * 0.3 * pxPerUnit;
  ctx.globalAlpha = 0.7;
  ctx.fill();
  // 数字そのもの
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = h * 0.06 * pxPerUnit;
  ctx.globalAlpha = 0.92;
  ctx.fill();
  ctx.restore();
}

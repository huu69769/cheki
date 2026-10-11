import type { LightLeakId, Rect } from '../model/types';
import { getNoiseTile } from '../util/canvas';

/** 粒子感。overlay 合成でノイズを重ねる。grainMm はノイズ1粒の大きさ（mm） */
export function drawGrain(ctx: CanvasRenderingContext2D, r: Rect, amount: number, grainMm = 0.07) {
  if (amount <= 0) return;
  const pattern = ctx.createPattern(getNoiseTile(), 'repeat');
  if (!pattern) return;
  if (typeof DOMMatrix !== 'undefined' && pattern.setTransform) {
    pattern.setTransform(new DOMMatrix([grainMm, 0, 0, grainMm, r.x, r.y]));
  }
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = Math.min(1, amount * 0.75);
  ctx.fillStyle = pattern;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

/** 紙の質感（フレーム用のごく薄いノイズ） */
export function drawPaperTexture(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const pattern = ctx.createPattern(getNoiseTile(), 'repeat');
  if (!pattern) return;
  if (typeof DOMMatrix !== 'undefined' && pattern.setTransform) {
    pattern.setTransform(new DOMMatrix([0.12, 0, 0, 0.12, 0, 0]));
  }
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** 周辺の暗さ */
export function drawVignette(ctx: CanvasRenderingContext2D, r: Rect, amount: number) {
  if (amount <= 0) return;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const rad = Math.hypot(r.w, r.h) / 2;
  const g = ctx.createRadialGradient(cx, cy, rad * 0.3, cx, cy, rad * 1.02);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.55, `rgba(0,0,0,${0.18 * amount})`);
  g.addColorStop(1, `rgba(0,0,0,${0.8 * amount})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

export const LIGHT_LEAKS: { id: LightLeakId; label: string }[] = [
  { id: 'none', label: 'なし' },
  { id: 'warm', label: 'ウォーム' },
  { id: 'pink', label: 'ピンク' },
  { id: 'rainbow', label: 'レインボー' },
  { id: 'sun', label: 'サン' },
];

/** 光漏れ。screen 合成で明るい色を重ねる */
export function drawLightLeak(ctx: CanvasRenderingContext2D, r: Rect, id: LightLeakId, amount: number) {
  if (id === 'none' || amount <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.min(1, amount);
  const { x, y, w, h } = r;
  const m = Math.max(w, h);

  const radial = (cx: number, cy: number, rad: number, stops: [number, string][]) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    for (const [o, c] of stops) g.addColorStop(o, c);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  };

  switch (id) {
    case 'warm': {
      radial(x - w * 0.08, y + h * 0.35, m * 0.75, [
        [0, 'rgba(255,90,20,0.95)'],
        [0.35, 'rgba(255,140,40,0.6)'],
        [1, 'rgba(255,140,40,0)'],
      ]);
      const g = ctx.createLinearGradient(x, 0, x + w * 0.25, 0);
      g.addColorStop(0, 'rgba(255,60,30,0.7)');
      g.addColorStop(1, 'rgba(255,60,30,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      break;
    }
    case 'pink': {
      radial(x + w * 1.05, y - h * 0.05, m * 0.8, [
        [0, 'rgba(255,70,140,0.95)'],
        [0.4, 'rgba(255,150,130,0.55)'],
        [1, 'rgba(255,150,130,0)'],
      ]);
      break;
    }
    case 'rainbow': {
      const g = ctx.createLinearGradient(x, y + h * 0.15, x + w * 0.75, y + h);
      const colors = ['#ff3b3b', '#ff9f1c', '#ffe14d', '#5bd96b', '#3ba7ff', '#a35bff'];
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.3, 'rgba(0,0,0,0)');
      colors.forEach((c, i) => g.addColorStop(0.36 + i * 0.05, c));
      g.addColorStop(0.68, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = Math.min(1, amount) * 0.55;
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      break;
    }
    case 'sun': {
      const sx = x + w * 0.15;
      const sy = y + h * 0.12;
      radial(sx, sy, m * 0.55, [
        [0, 'rgba(255,255,230,1)'],
        [0.12, 'rgba(255,230,150,0.85)'],
        [0.45, 'rgba(255,170,60,0.3)'],
        [1, 'rgba(255,170,60,0)'],
      ]);
      // レンズフレアの玉
      const dx = x + w * 0.85 - sx;
      const dy = y + h * 0.9 - sy;
      const balls: [number, number, string][] = [
        [0.35, 0.05, 'rgba(255,200,120,0.35)'],
        [0.55, 0.03, 'rgba(160,220,255,0.35)'],
        [0.75, 0.08, 'rgba(255,160,200,0.22)'],
      ];
      for (const [t, rr, c] of balls) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(sx + dx * t, sy + dy * t, m * rr, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
  ctx.restore();
}

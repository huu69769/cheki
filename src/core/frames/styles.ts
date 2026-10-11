/**
 * フレームの色・柄。すべてコードで描いているオリジナル素材（外部画像なし）。
 * draw は mm 単位の座標系で呼ばれる。
 */

export interface FrameStyle {
  id: string;
  label: string;
  /** 一覧に出すときの見本色 */
  swatch: string;
  base: string;
  /** 余白に置く文字の既定色 */
  ink: string;
  draw?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

function dots(color: string, spacing: number, r: number) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = color;
    let row = 0;
    for (let y = spacing / 2; y < h + spacing; y += spacing * 0.866, row++) {
      const offset = row % 2 ? spacing / 2 : 0;
      for (let x = offset; x < w + spacing; x += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
}

function stripes(color: string, width: number, gap: number) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = color;
    const step = width + gap;
    for (let x = -h; x < w + h; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + width, 0);
      ctx.lineTo(x + width + h, h);
      ctx.lineTo(x + h, h);
      ctx.closePath();
      ctx.fill();
    }
  };
}

function gingham(color: string, cell: number) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.45;
    for (let x = 0; x < w; x += cell * 2) ctx.fillRect(x, 0, cell, h);
    for (let y = 0; y < h; y += cell * 2) ctx.fillRect(0, y, w, cell);
    ctx.globalAlpha = 1;
  };
}

function checker(color: string, cell: number) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = color;
    for (let y = 0, r = 0; y < h; y += cell, r++) {
      for (let x = (r % 2) * cell; x < w; x += cell * 2) ctx.fillRect(x, y, cell, cell);
    }
  };
}

function heartPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.35);
  ctx.bezierCurveTo(cx - s * 0.6, cy - s * 0.05, cx - s * 0.3, cy - s * 0.55, cx, cy - s * 0.2);
  ctx.bezierCurveTo(cx + s * 0.3, cy - s * 0.55, cx + s * 0.6, cy - s * 0.05, cx, cy + s * 0.35);
  ctx.closePath();
}

function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = rot + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function scattered(
  drawOne: (ctx: CanvasRenderingContext2D, x: number, y: number, i: number) => void,
  spacing: number,
) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    let i = 0;
    for (let y = spacing / 2, row = 0; y < h + spacing; y += spacing, row++) {
      for (let x = (row % 2 ? spacing / 2 : 0) + spacing / 4; x < w + spacing; x += spacing) {
        drawOne(ctx, x, y, i++);
      }
    }
  };
}

/** 決まった乱数（毎回同じ柄になるように） */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const FRAME_STYLES: FrameStyle[] = [
  { id: 'white', label: 'ホワイト', swatch: '#fbfaf6', base: '#fbfaf6', ink: '#333333' },
  { id: 'cream', label: 'クリーム', swatch: '#f3ead7', base: '#f3ead7', ink: '#5a4632' },
  { id: 'black', label: 'ブラック', swatch: '#1f1f22', base: '#1f1f22', ink: '#f5f5f5' },
  { id: 'pink', label: 'ピンク', swatch: '#f7cfd8', base: '#f7cfd8', ink: '#9c3d57' },
  { id: 'mint', label: 'ミント', swatch: '#cdeadc', base: '#cdeadc', ink: '#2f6b55' },
  { id: 'sky', label: 'スカイ', swatch: '#cfe2f4', base: '#cfe2f4', ink: '#2f5680' },
  { id: 'lavender', label: 'ラベンダー', swatch: '#ddd4f0', base: '#ddd4f0', ink: '#55437f' },
  { id: 'lemon', label: 'レモン', swatch: '#f6ecaa', base: '#f6ecaa', ink: '#6b5a14' },
  {
    id: 'dots',
    label: 'ドット',
    swatch: '#fbeef0',
    base: '#fdf3f4',
    ink: '#b04a66',
    draw: dots('#f2a7b8', 6, 1.1),
  },
  {
    id: 'stripe',
    label: 'ストライプ',
    swatch: '#d6e6f7',
    base: '#fbfbfb',
    ink: '#2f5680',
    draw: stripes('#bcd6f0', 2.4, 2.4),
  },
  {
    id: 'gingham',
    label: 'ギンガム',
    swatch: '#f0b9b9',
    base: '#fffafa',
    ink: '#a23838',
    draw: gingham('#e57f7f', 3),
  },
  {
    id: 'checker',
    label: 'チェッカー',
    swatch: '#3a3a3a',
    base: '#f4f1ea',
    ink: '#222222',
    draw: checker('#2c2c2c', 3),
  },
  {
    id: 'hearts',
    label: 'ハート',
    swatch: '#f6b6c8',
    base: '#f6c3d1',
    ink: '#9c2f52',
    draw: scattered((ctx, x, y, i) => {
      ctx.fillStyle = i % 3 === 0 ? '#ffffff' : 'rgba(255,255,255,0.65)';
      heartPath(ctx, x, y, 3.2);
      ctx.fill();
    }, 8),
  },
  {
    id: 'stars',
    label: '星空',
    swatch: '#2c3566',
    base: '#262d5a',
    ink: '#fff3b0',
    draw: (ctx, w, h) => {
      const rnd = seeded(7);
      for (let i = 0; i < (w * h) / 22; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = 0.15 + rnd() * 0.25;
        ctx.fillStyle = `rgba(255,255,255,${0.4 + rnd() * 0.6})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      scattered((c, x, y, i) => {
        c.fillStyle = i % 2 ? '#ffe680' : '#fff6c9';
        starPath(c, x + (i % 3) * 1.5, y, 1.6, -Math.PI / 2 + i * 0.3);
        c.fill();
      }, 13)(ctx, w, h);
    },
  },
  {
    id: 'kraft',
    label: 'クラフト',
    swatch: '#c9a77c',
    base: '#cfae84',
    ink: '#4a3420',
    draw: (ctx, w, h) => {
      const rnd = seeded(11);
      ctx.lineWidth = 0.08;
      for (let i = 0; i < (w * h) / 6; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const a = rnd() * Math.PI;
        const l = 0.6 + rnd() * 1.8;
        ctx.strokeStyle = rnd() > 0.5 ? 'rgba(90,60,30,0.25)' : 'rgba(255,240,215,0.3)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        ctx.stroke();
      }
    },
  },
  {
    id: 'dream',
    label: 'ゆめかわ',
    swatch: '#e7d3f2',
    base: '#f4d6e6',
    ink: '#7a4f8f',
    draw: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#f9cfe0');
      g.addColorStop(0.5, '#dcd3f6');
      g.addColorStop(1, '#c9ecf0');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      scattered((c, x, y, i) => {
        c.fillStyle = 'rgba(255,255,255,0.8)';
        if (i % 2) {
          starPath(c, x, y, 1.2);
        } else {
          c.beginPath();
          c.arc(x, y, 0.6, 0, Math.PI * 2);
        }
        c.fill();
      }, 9)(ctx, w, h);
    },
  },
];

export const DEFAULT_FRAME_STYLE_ID = 'white';

export function getFrameStyle(id: string): FrameStyle {
  return FRAME_STYLES.find((s) => s.id === id) ?? FRAME_STYLES[0];
}

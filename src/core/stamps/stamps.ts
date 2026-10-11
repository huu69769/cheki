/**
 * スタンプ。すべてこのアプリのためにコードで描いたオリジナル素材。
 * render は中心 (0,0)、幅・高さ 100 の座標系で呼ばれる。
 */

export interface StampDef {
  id: string;
  label: string;
  defaultColor: string;
  render: (ctx: CanvasRenderingContext2D, color: string) => void;
}

const BORDER = '#ffffff';
const DARK = '#3a2a2a';

/** シール風：白いふちを付けてから色を塗る */
function sticker(ctx: CanvasRenderingContext2D, build: (c: CanvasRenderingContext2D) => void, color: string) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  build(ctx);
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fill();
}

function heart(c: CanvasRenderingContext2D) {
  c.beginPath();
  c.moveTo(0, 38);
  c.bezierCurveTo(-30, 18, -48, 2, -46, -18);
  c.bezierCurveTo(-44, -40, -14, -46, 0, -24);
  c.bezierCurveTo(14, -46, 44, -40, 46, -18);
  c.bezierCurveTo(48, 2, 30, 18, 0, 38);
  c.closePath();
}

function star(c: CanvasRenderingContext2D, r = 46, cx = 0, cy = 4) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.46 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.closePath();
}

function sparkleAt(c: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const k = r * 0.13;
  c.moveTo(cx, cy - r);
  c.quadraticCurveTo(cx + k, cy - k, cx + r, cy);
  c.quadraticCurveTo(cx + k, cy + k, cx, cy + r);
  c.quadraticCurveTo(cx - k, cy + k, cx - r, cy);
  c.quadraticCurveTo(cx - k, cy - k, cx, cy - r);
  c.closePath();
}

function highlight(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

export const STAMPS: StampDef[] = [
  {
    id: 'heart',
    label: 'ハート',
    defaultColor: '#ff5a7a',
    render: (ctx, color) => {
      sticker(ctx, heart, color);
      highlight(ctx, -26, -22, 8, 5, -0.7);
    },
  },
  {
    id: 'star',
    label: '星',
    defaultColor: '#ffc93c',
    render: (ctx, color) => sticker(ctx, (c) => star(c), color),
  },
  {
    id: 'sparkle',
    label: 'キラキラ',
    defaultColor: '#ffd84d',
    render: (ctx, color) =>
      sticker(
        ctx,
        (c) => {
          c.beginPath();
          sparkleAt(c, -8, 6, 40);
          sparkleAt(c, 30, -30, 16);
        },
        color,
      ),
  },
  {
    id: 'flower',
    label: 'お花',
    defaultColor: '#ff9ec4',
    render: (ctx, color) => {
      sticker(
        ctx,
        (c) => {
          c.beginPath();
          for (let i = 0; i < 5; i++) {
            const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
            const x = Math.cos(a) * 24;
            const y = Math.sin(a) * 24;
            c.moveTo(x + 21, y);
            c.arc(x, y, 21, 0, Math.PI * 2);
          }
        },
        color,
      );
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: 'crown',
    label: 'クラウン',
    defaultColor: '#f5c542',
    render: (ctx, color) => {
      sticker(
        ctx,
        (c) => {
          c.beginPath();
          c.moveTo(-40, 28);
          c.lineTo(-45, -22);
          c.lineTo(-20, 2);
          c.lineTo(0, -34);
          c.lineTo(20, 2);
          c.lineTo(45, -22);
          c.lineTo(40, 28);
          c.closePath();
        },
        color,
      );
      ctx.fillStyle = '#ffffff';
      for (const [x, y] of [
        [-45, -24],
        [0, -36],
        [45, -24],
      ]) {
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(-38, 14, 76, 6);
    },
  },
  {
    id: 'ribbon',
    label: 'リボン',
    defaultColor: '#ff6f91',
    render: (ctx, color) => {
      sticker(
        ctx,
        (c) => {
          c.beginPath();
          // 左の輪
          c.moveTo(-4, 0);
          c.bezierCurveTo(-30, -36, -54, -22, -46, 0);
          c.bezierCurveTo(-54, 22, -30, 36, -4, 0);
          // 右の輪
          c.moveTo(4, 0);
          c.bezierCurveTo(30, -36, 54, -22, 46, 0);
          c.bezierCurveTo(54, 22, 30, 36, 4, 0);
          // 垂れ
          c.moveTo(-6, 4);
          c.lineTo(-24, 44);
          c.lineTo(-12, 40);
          c.lineTo(-4, 48);
          c.lineTo(2, 8);
          c.moveTo(6, 4);
          c.lineTo(24, 44);
          c.lineTo(12, 40);
          c.lineTo(4, 48);
          c.lineTo(-2, 8);
          c.moveTo(11, 0);
          c.arc(0, 0, 11, 0, Math.PI * 2);
        },
        color,
      );
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: 'cloud',
    label: 'くも',
    defaultColor: '#bfe3ff',
    render: (ctx, color) =>
      sticker(
        ctx,
        (c) => {
          c.beginPath();
          c.moveTo(-6, 6);
          c.arc(-24, 6, 18, 0, Math.PI * 2);
          c.moveTo(24, -6);
          c.arc(0, -6, 24, 0, Math.PI * 2);
          c.moveTo(42, 6);
          c.arc(24, 6, 18, 0, Math.PI * 2);
          c.rect(-24, 6, 48, 18);
        },
        color,
      ),
  },
  {
    id: 'note',
    label: '音符',
    defaultColor: '#7c6cff',
    render: (ctx, color) =>
      sticker(
        ctx,
        (c) => {
          c.beginPath();
          c.ellipse(-22, 28, 14, 10, -0.4, 0, Math.PI * 2);
          c.moveTo(36, 18);
          c.ellipse(22, 18, 14, 10, -0.4, 0, Math.PI * 2);
          c.rect(-11, -26, 7, 54);
          c.rect(29, -36, 7, 54);
          c.moveTo(-11, -26);
          c.lineTo(36, -38);
          c.lineTo(36, -26);
          c.lineTo(-11, -14);
          c.closePath();
        },
        color,
      ),
  },
  {
    id: 'bolt',
    label: 'いなずま',
    defaultColor: '#ffd23f',
    render: (ctx, color) =>
      sticker(
        ctx,
        (c) => {
          c.beginPath();
          c.moveTo(10, -48);
          c.lineTo(-24, 4);
          c.lineTo(-2, 4);
          c.lineTo(-12, 48);
          c.lineTo(26, -10);
          c.lineTo(4, -10);
          c.lineTo(18, -48);
          c.closePath();
        },
        color,
      ),
  },
  {
    id: 'moon',
    label: '月',
    defaultColor: '#ffe27a',
    render: (ctx, color) => {
      const crescent = (outer: number, inner: number, fill: string) => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(-80, -80, 160, 160);
        ctx.arc(16, -12, inner, 0, Math.PI * 2, true);
        ctx.clip('evenodd');
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(0, 0, outer, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      crescent(44, 30, BORDER);
      crescent(40, 34, color);
    },
  },
  {
    id: 'smile',
    label: 'スマイル',
    defaultColor: '#ffd23f',
    render: (ctx, color) => {
      sticker(
        ctx,
        (c) => {
          c.beginPath();
          c.arc(0, 0, 44, 0, Math.PI * 2);
        },
        color,
      );
      ctx.fillStyle = DARK;
      ctx.beginPath();
      ctx.ellipse(-15, -10, 5, 8, 0, 0, Math.PI * 2);
      ctx.ellipse(15, -10, 5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = DARK;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 4, 22, 0.25 * Math.PI, 0.75 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,120,120,0.45)';
      ctx.beginPath();
      ctx.ellipse(-28, 10, 7, 4.5, 0, 0, Math.PI * 2);
      ctx.ellipse(28, 10, 7, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: 'cat',
    label: 'ねこ',
    defaultColor: '#f4a261',
    render: (ctx, color) => {
      sticker(
        ctx,
        (c) => {
          c.beginPath();
          c.moveTo(-40, -6);
          c.lineTo(-38, -46);
          c.lineTo(-12, -28);
          c.lineTo(12, -28);
          c.lineTo(38, -46);
          c.lineTo(40, -6);
          c.closePath();
          c.moveTo(44, 8);
          c.ellipse(0, 8, 44, 34, 0, 0, Math.PI * 2);
        },
        color,
      );
      ctx.fillStyle = DARK;
      ctx.beginPath();
      ctx.ellipse(-16, 4, 4.5, 7, 0, 0, Math.PI * 2);
      ctx.ellipse(16, 4, 4.5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff8fa3';
      ctx.beginPath();
      ctx.moveTo(-4, 15);
      ctx.lineTo(4, 15);
      ctx.lineTo(0, 20);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = DARK;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (const s of [-1, 1]) {
        ctx.moveTo(s * 24, 16);
        ctx.lineTo(s * 46, 12);
        ctx.moveTo(s * 24, 21);
        ctx.lineTo(s * 46, 24);
      }
      ctx.stroke();
    },
  },
  {
    id: 'bubble',
    label: 'ふきだし',
    defaultColor: '#ffffff',
    render: (ctx, color) =>
      sticker(
        ctx,
        (c) => {
          c.beginPath();
          const x = -46;
          const y = -34;
          const w = 92;
          const h = 56;
          const r = 18;
          c.moveTo(x + r, y);
          c.arcTo(x + w, y, x + w, y + h, r);
          c.arcTo(x + w, y + h, x, y + h, r);
          c.lineTo(4, y + h);
          c.lineTo(-24, 44);
          c.lineTo(-14, y + h);
          c.arcTo(x, y + h, x, y, r);
          c.arcTo(x, y, x + w, y, r);
          c.closePath();
        },
        color,
      ),
  },
  {
    id: 'lines',
    label: '効果線',
    defaultColor: '#ff7a3d',
    render: (ctx, color) => {
      const draw = (stroke: string, width: number) => {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-30, 30);
        ctx.lineTo(-10, 6);
        ctx.moveTo(-40, -8);
        ctx.lineTo(-10, -8);
        ctx.moveTo(-26, -42);
        ctx.lineTo(-8, -22);
        ctx.moveTo(30, 30);
        ctx.lineTo(10, 6);
        ctx.moveTo(40, -8);
        ctx.lineTo(10, -8);
        ctx.moveTo(26, -42);
        ctx.lineTo(8, -22);
        ctx.stroke();
      };
      draw(BORDER, 17);
      draw(color, 9);
    },
  },
  {
    id: 'ring',
    label: 'ぐるぐる',
    defaultColor: '#ff3b5c',
    render: (ctx, color) => {
      const draw = (stroke: string, width: number) => {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i <= 80; i++) {
          const t = (i / 80) * Math.PI * 2 * 1.15 - 0.4;
          const r = 1 - (i / 80) * 0.12;
          const x = Math.cos(t) * 44 * r;
          const y = Math.sin(t) * 30 * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      draw(BORDER, 13);
      draw(color, 6);
    },
  },
];

export function getStamp(id: string): StampDef {
  return STAMPS.find((s) => s.id === id) ?? STAMPS[0];
}

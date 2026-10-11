/** Canvas まわりの小さな道具 */

export function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function get2d(c: HTMLCanvasElement, opts?: CanvasRenderingContext2DSettings): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', opts);
  if (!ctx) throw new Error('Canvas が使えません');
  return ctx;
}

/**
 * iOS Safari は使い終わった Canvas のメモリをすぐ解放しないことがあるので、
 * 大きな Canvas は使い終わったら大きさを 0 にしておく。
 */
export function releaseCanvas(c: HTMLCanvasElement | null | undefined) {
  if (!c) return;
  c.width = 0;
  c.height = 0;
}

export function canvasToBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    c.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('画像の書き出しに失敗しました'))),
      type,
      quality,
    );
  });
}

/** 決まった乱数（毎回同じ結果になる） */
export function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

let noiseTile: HTMLCanvasElement | null = null;

/** 灰色(128)を中心にしたノイズのタイル（粒子・紙の質感に使う） */
export function getNoiseTile(): HTMLCanvasElement {
  if (noiseTile) return noiseTile;
  const size = 256;
  const c = createCanvas(size, size);
  const ctx = get2d(c);
  const img = ctx.createImageData(size, size);
  const rnd = seededRandom(1234);
  for (let i = 0; i < img.data.length; i += 4) {
    // 2つの乱数の和で、真ん中に寄った分布にする
    const v = 128 + ((rnd() + rnd() + rnd()) / 3 - 0.5) * 220;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noiseTile = c;
  return c;
}

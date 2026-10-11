import { applyFilterToImageData, getFilter } from '../filters/filters';
import { createCanvas, get2d, releaseCanvas } from '../util/canvas';
import type { PhotoSource } from './renderer';

/** 読み込んだ写真の最大の長辺（これより大きい写真は縮小して扱う。メモリ対策） */
export const MAX_SOURCE_SIDE = 4096;
/** 編集画面のプレビューで使う写真の長辺 */
export const PREVIEW_SOURCE_SIDE = 1600;

export interface LoadedPhoto {
  /** 元の写真（長辺 MAX_SOURCE_SIDE 以下に縮小済み） */
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

async function decodeImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // decode 後は画像データを保持しているので URL は解放してよい
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** Blob から写真を読み込む（向きは EXIF に従ってブラウザが補正する） */
export async function loadPhoto(blob: Blob): Promise<LoadedPhoto> {
  let img: HTMLImageElement;
  try {
    img = await decodeImage(blob);
  } catch {
    throw new Error('この写真は読み込めませんでした。別の写真を選んでください。');
  }
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  if (!w0 || !h0) throw new Error('この写真は読み込めませんでした。');
  const k = Math.min(1, MAX_SOURCE_SIDE / Math.max(w0, h0));
  const w = Math.round(w0 * k);
  const h = Math.round(h0 * k);
  const canvas = createCanvas(w, h);
  const ctx = get2d(canvas);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return { canvas, width: w, height: h };
}

/** 長辺 maxSide に縮小したコピー（小さければそのままコピー） */
export function resizeCanvas(src: HTMLCanvasElement, maxSide: number): HTMLCanvasElement {
  const k = Math.min(1, maxSide / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * k));
  const h = Math.max(1, Math.round(src.height * k));
  const c = createCanvas(w, h);
  const ctx = get2d(c);
  ctx.imageSmoothingQuality = 'high';
  // 大きく縮小するときは段階的に縮めると、ギザギザになりにくい
  let cur: HTMLCanvasElement = src;
  while (cur.width * 0.5 > w * 1.0001 && cur.width / 2 >= 1) {
    const half = createCanvas(Math.round(cur.width / 2), Math.round(cur.height / 2));
    const hctx = get2d(half);
    hctx.imageSmoothingQuality = 'high';
    hctx.drawImage(cur, 0, 0, half.width, half.height);
    if (cur !== src) releaseCanvas(cur);
    cur = half;
  }
  ctx.drawImage(cur, 0, 0, w, h);
  if (cur !== src) releaseCanvas(cur);
  return c;
}

/** canvas にフィルターをかける（その canvas を書き換える） */
export function filterCanvasInPlace(c: HTMLCanvasElement, filterId: string, strength: number) {
  const f = getFilter(filterId);
  if (f.id === 'none' || strength <= 0) return;
  const ctx = get2d(c, { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, c.width, c.height);
  applyFilterToImageData(img.data, f.params, strength);
  ctx.putImageData(img, 0, 0);
}

/**
 * 指定した長辺でフィルター済みの写真を作る。
 * 論理的な大きさ（width/height）は元の写真のままにしておくので、
 * 解像度が違っても描画位置は変わらない。
 */
export function makePhotoSource(photo: LoadedPhoto, maxSide: number, filterId: string, strength: number): PhotoSource {
  const c = resizeCanvas(photo.canvas, maxSide);
  filterCanvasInPlace(c, filterId, strength);
  return { image: c, width: photo.width, height: photo.height };
}

/**
 * プレビュー用のフィルター済み写真を、同じ設定なら使い回すためのキャッシュ。
 */
export class PreviewPhotoCache {
  private base: HTMLCanvasElement | null = null;
  private baseOf: LoadedPhoto | null = null;
  private filtered: { key: string; source: PhotoSource } | null = null;

  get(photo: LoadedPhoto, filterId: string, strength: number): PhotoSource {
    if (this.baseOf !== photo) {
      this.dispose();
      this.base = resizeCanvas(photo.canvas, PREVIEW_SOURCE_SIDE);
      this.baseOf = photo;
    }
    const base = this.base!;
    const key = `${filterId}|${strength.toFixed(3)}`;
    if (this.filtered && this.filtered.key === key) return this.filtered.source;
    let image: HTMLCanvasElement = base;
    if (getFilter(filterId).id !== 'none' && strength > 0) {
      const prev = this.filtered?.source.image;
      const c = prev instanceof HTMLCanvasElement && prev !== base ? prev : createCanvas(base.width, base.height);
      const ctx = get2d(c, { willReadFrequently: true });
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(base, 0, 0);
      filterCanvasInPlace(c, filterId, strength);
      image = c;
    }
    this.filtered = { key, source: { image, width: photo.width, height: photo.height } };
    return this.filtered.source;
  }

  dispose() {
    const img = this.filtered?.source.image;
    if (img instanceof HTMLCanvasElement && img !== this.base) releaseCanvas(img);
    releaseCanvas(this.base);
    this.base = null;
    this.baseOf = null;
    this.filtered = null;
  }
}

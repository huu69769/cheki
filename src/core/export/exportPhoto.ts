import { FRAME_SHAPES } from '../frames/shapes';
import { ensureFontLoaded, getFont } from '../fonts/fonts';
import type { PhotoDoc } from '../model/types';
import { makePhotoSource, type LoadedPhoto } from '../render/photoSource';
import { coverScale, renderDocument } from '../render/renderer';
import { canvasToBlob, createCanvas, get2d, releaseCanvas } from '../util/canvas';

export type PhotoFormat = 'jpeg' | 'png';
export type PhotoQuality = 'standard' | 'high';

export interface PhotoExportOptions {
  format: PhotoFormat;
  quality: PhotoQuality;
}

export interface PhotoExportResult {
  blob: Blob;
  mimeType: string;
  filename: string;
  width: number;
  height: number;
}

/** 1mm あたりのピクセル数（標準：ミニで約 1350×2150px、高画質：約 2160×3440px） */
const PX_PER_MM: Record<PhotoQuality, number> = { standard: 25, high: 40 };
/** iPhone の Canvas の上限（約1670万画素）より十分小さく抑える */
const MAX_PIXELS = 12_000_000;

function timestamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** 書き出したときの大きさ（px） */
export function exportSize(doc: PhotoDoc, quality: PhotoQuality): { width: number; height: number; pxPerMm: number } {
  const shape = FRAME_SHAPES[doc.frame.shapeId];
  let pxPerMm = PX_PER_MM[quality];
  const area = shape.width * shape.height * pxPerMm * pxPerMm;
  if (area > MAX_PIXELS) pxPerMm *= Math.sqrt(MAX_PIXELS / area);
  return { width: Math.round(shape.width * pxPerMm), height: Math.round(shape.height * pxPerMm), pxPerMm };
}

/**
 * 編集内容を高解像度の画像として書き出す。
 * 画面表示と同じ renderDocument を、大きな拡大率で呼ぶだけなので、見たままの仕上がりになる。
 */
export async function exportPhoto(doc: PhotoDoc, photo: LoadedPhoto, opts: PhotoExportOptions): Promise<PhotoExportResult> {
  // 文字のフォントを読み込み終わってから描く
  await Promise.all(
    doc.layers.map((l) => (l.kind === 'text' ? ensureFontLoaded(getFont(l.fontId), l.text) : Promise.resolve())),
  );

  const shape = FRAME_SHAPES[doc.frame.shapeId];
  const { width, height, pxPerMm } = exportSize(doc, opts.quality);

  // 写真は、書き出しの大きさに必要な解像度まで縮めてからフィルターをかける（処理を軽くするため）
  const photoPxPerSourcePx = coverScale(shape.window, photo.width, photo.height) * doc.photo.scale * pxPerMm;
  const neededSide = Math.ceil(Math.max(photo.width, photo.height) * Math.min(1, photoPxPerSourcePx * 1.05));
  const source = makePhotoSource(photo, neededSide, doc.effects.filterId, doc.effects.filterStrength);

  const canvas = createCanvas(width, height);
  try {
    const ctx = get2d(canvas);
    renderDocument(ctx, doc, source, { pxPerMm, cacheFrame: false });
    const mimeType = opts.format === 'png' ? 'image/png' : 'image/jpeg';
    const blob = await canvasToBlob(canvas, mimeType, opts.format === 'jpeg' ? 0.92 : undefined);
    const ext = opts.format === 'png' ? 'png' : 'jpg';
    return { blob, mimeType, filename: `film-${timestamp()}.${ext}`, width, height };
  } finally {
    releaseCanvas(canvas);
    if (source.image instanceof HTMLCanvasElement && source.image !== photo.canvas) releaseCanvas(source.image);
  }
}

import { FRAME_SHAPES } from '../frames/shapes';
import { coverScale } from '../render/renderer';
import type { PhotoDoc } from './types';

/**
 * 写真を動かし終わったとき、窓にすき間ができていたら写真を端に寄せてすき間をなくす。
 * （写真を窓より小さくしている場合や、斜めに回転している場合はそのままにする）
 */
export function fitPhotoToWindow(doc: PhotoDoc, imgW: number, imgH: number): PhotoDoc {
  const win = FRAME_SHAPES[doc.frame.shapeId].window;
  const t = doc.photo;
  const quarter = Math.round(t.rotation / (Math.PI / 2));
  if (Math.abs(t.rotation - quarter * (Math.PI / 2)) > 1e-6) return doc;
  const s = coverScale(win, imgW, imgH) * t.scale;
  let w = imgW * s;
  let h = imgH * s;
  if (Math.abs(quarter) % 2 === 1) [w, h] = [h, w];
  const eps = 1e-6;
  if (w < win.w - eps || h < win.h - eps) return doc;
  const maxX = (w - win.w) / 2;
  const maxY = (h - win.h) / 2;
  const x = Math.min(maxX, Math.max(-maxX, t.x));
  const y = Math.min(maxY, Math.max(-maxY, t.y));
  if (x === t.x && y === t.y) return doc;
  return { ...doc, photo: { ...t, x, y } };
}

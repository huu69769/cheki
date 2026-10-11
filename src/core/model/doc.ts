import { FRAME_SHAPES, marginCenter } from '../frames/shapes';
import { DEFAULT_FRAME_STYLE_ID, getFrameStyle } from '../frames/styles';
import { DEFAULT_FONT_ID } from '../fonts/fonts';
import type { FrameShapeId, Layer, PhotoDoc, StampLayer, TextLayer } from './types';
import { getStamp } from '../stamps/stamps';

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function todayString(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const DATE_STAMP_COLORS = [
  { id: 'orange', label: 'オレンジ', color: '#ff8a1e' },
  { id: 'red', label: 'レッド', color: '#ff4b2b' },
  { id: 'yellow', label: 'イエロー', color: '#ffd23a' },
];

export function createDoc(photoDate?: string): PhotoDoc {
  return {
    version: 1,
    frame: { shapeId: 'mini', styleId: DEFAULT_FRAME_STYLE_ID },
    photo: { x: 0, y: 0, scale: 1, rotation: 0, flipX: false },
    effects: {
      filterId: 'none',
      filterStrength: 1,
      grain: 0,
      vignette: 0,
      lightLeak: 'none',
      lightLeakStrength: 0.7,
    },
    dateStamp: {
      enabled: false,
      date: photoDate ?? todayString(),
      format: 'yy-mm-dd',
      position: 'br',
      color: DATE_STAMP_COLORS[0].color,
    },
    layers: [],
  };
}

/** フレームの形を変える。文字などはフレームの中心からの位置を保つ */
export function changeShape(doc: PhotoDoc, shapeId: FrameShapeId): PhotoDoc {
  if (doc.frame.shapeId === shapeId) return doc;
  const oldW = FRAME_SHAPES[doc.frame.shapeId].width;
  const newW = FRAME_SHAPES[shapeId].width;
  const dx = (newW - oldW) / 2;
  return {
    ...doc,
    frame: { ...doc.frame, shapeId },
    layers: doc.layers.map((l) => ({ ...l, x: l.x + dx })),
  };
}

export function createTextLayer(doc: PhotoDoc, text: string, opts?: Partial<TextLayer>): TextLayer {
  const shape = FRAME_SHAPES[doc.frame.shapeId];
  const pos = marginCenter(shape);
  return {
    kind: 'text',
    id: newId(),
    text,
    fontId: DEFAULT_FONT_ID,
    color: getFrameStyle(doc.frame.styleId).ink,
    size: 6,
    x: pos.x,
    y: pos.y,
    rotation: 0,
    style: 'plain',
    ...opts,
  };
}

export function createStampLayer(doc: PhotoDoc, stampId: string): StampLayer {
  const shape = FRAME_SHAPES[doc.frame.shapeId];
  const win = shape.window;
  // 少しずつずらして置く（重ならないように）
  const n = doc.layers.filter((l) => l.kind === 'stamp').length;
  const ox = ((n % 3) - 1) * 8;
  const oy = ((Math.floor(n / 3) % 3) - 1) * 8;
  return {
    kind: 'stamp',
    id: newId(),
    stampId,
    color: getStamp(stampId).defaultColor,
    size: 14,
    x: win.x + win.w / 2 + ox,
    y: win.y + win.h / 2 + oy,
    rotation: 0,
  };
}

export function updateLayer(doc: PhotoDoc, id: string, patch: Partial<Layer>): PhotoDoc {
  return {
    ...doc,
    layers: doc.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)),
  };
}

export function removeLayer(doc: PhotoDoc, id: string): PhotoDoc {
  return { ...doc, layers: doc.layers.filter((l) => l.id !== id) };
}

export function bringToFront(doc: PhotoDoc, id: string): PhotoDoc {
  const layer = doc.layers.find((l) => l.id === id);
  if (!layer) return doc;
  return { ...doc, layers: [...doc.layers.filter((l) => l.id !== id), layer] };
}

/** 下書きから読み込んだデータを、今のバージョンの形に整える */
export function normalizeDoc(raw: unknown): PhotoDoc | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<PhotoDoc>;
  if (d.version !== 1 || !d.frame || !d.photo) return null;
  const base = createDoc();
  return {
    ...base,
    ...d,
    frame: { ...base.frame, ...d.frame },
    photo: { ...base.photo, ...d.photo },
    effects: { ...base.effects, ...d.effects },
    dateStamp: { ...base.dateStamp, ...d.dateStamp },
    layers: Array.isArray(d.layers) ? d.layers : [],
  };
}

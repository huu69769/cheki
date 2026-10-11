import { canvasFont, getFont } from '../fonts/fonts';
import type { Layer, PhotoDoc, TextLayer } from '../model/types';
import { FRAME_SHAPES } from '../frames/shapes';

let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx(): CanvasRenderingContext2D {
  if (!measureCtx) {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    measureCtx = c.getContext('2d');
    if (!measureCtx) throw new Error('Canvas が使えません');
  }
  return measureCtx;
}

const MEASURE_PX = 100;

export function textLines(text: string): string[] {
  const lines = text.split('\n');
  return lines.length ? lines : [''];
}

/** 文字レイヤーの大きさ（mm） */
export function measureTextLayer(layer: TextLayer): { w: number; h: number } {
  const font = getFont(layer.fontId);
  const ctx = getMeasureCtx();
  ctx.font = canvasFont(font, MEASURE_PX);
  const lines = textLines(layer.text);
  let maxW = 0;
  for (const line of lines) maxW = Math.max(maxW, ctx.measureText(line || ' ').width);
  const k = layer.size / MEASURE_PX;
  return { w: Math.max(maxW * k, layer.size * 0.6), h: lines.length * layer.size * font.lineHeight };
}

export function layerSize(layer: Layer): { w: number; h: number } {
  if (layer.kind === 'text') return measureTextLayer(layer);
  return { w: layer.size, h: layer.size };
}

/** フレーム座標の点を、レイヤーの中心・回転を基準にした座標に変換 */
export function toLocal(layer: Layer, x: number, y: number): { x: number; y: number } {
  const dx = x - layer.x;
  const dy = y - layer.y;
  const c = Math.cos(-layer.rotation);
  const s = Math.sin(-layer.rotation);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

export function toWorld(layer: Layer, lx: number, ly: number): { x: number; y: number } {
  const c = Math.cos(layer.rotation);
  const s = Math.sin(layer.rotation);
  return { x: layer.x + lx * c - ly * s, y: layer.y + lx * s + ly * c };
}

/** 指で触れた位置にあるレイヤー（手前のものを優先）。pad は当たり判定の余裕（mm） */
export function hitTestLayers(doc: PhotoDoc, x: number, y: number, pad: number): Layer | null {
  for (let i = doc.layers.length - 1; i >= 0; i--) {
    const layer = doc.layers[i];
    const { w, h } = layerSize(layer);
    const p = toLocal(layer, x, y);
    if (Math.abs(p.x) <= w / 2 + pad && Math.abs(p.y) <= h / 2 + pad) return layer;
  }
  return null;
}

/** 選択枠のつまみの位置（mm） */
export function selectionHandles(layer: Layer, pad: number) {
  const { w, h } = layerSize(layer);
  return {
    transform: toWorld(layer, w / 2 + pad, h / 2 + pad),
    remove: toWorld(layer, -w / 2 - pad, -h / 2 - pad),
  };
}

export function frameSize(doc: PhotoDoc): { w: number; h: number } {
  const s = FRAME_SHAPES[doc.frame.shapeId];
  return { w: s.width, h: s.height };
}

import { FRAME_SHAPES, type FrameShape } from '../frames/shapes';
import { getFrameStyle } from '../frames/styles';
import { canvasFont, getFont } from '../fonts/fonts';
import type { Layer, PhotoDoc, PhotoTransform, Rect, StampLayer, TextLayer } from '../model/types';
import { getStamp } from '../stamps/stamps';
import { createCanvas, get2d } from '../util/canvas';
import { drawDateStamp, formatDateStamp } from './dateStamp';
import { drawGrain, drawLightLeak, drawPaperTexture, drawVignette } from './effects';
import { layerSize, selectionHandles, textLines } from './geometry';

/**
 * 描画エンジン。プレビュー（画面表示）と書き出しの両方で同じ関数を使うので、
 * 画面で見たとおりの仕上がりになる。
 */

/** 描画に使う写真（フィルター適用済みの画像と、その論理的な大きさ） */
export interface PhotoSource {
  image: CanvasImageSource;
  width: number;
  height: number;
}

export interface RenderOptions {
  /** 1mm あたりのピクセル数 */
  pxPerMm: number;
  /** 選択中のレイヤー（プレビューのみ） */
  selectedLayerId?: string | null;
  /** 窓からはみ出した写真をうっすら表示する（写真を動かしている間） */
  showPhotoOverflow?: boolean;
  /** 選択枠などUIの大きさ（画面上の 1px が何 mm か） */
  uiMmPerPx?: number;
  /** フレームの背景をキャッシュする（プレビュー用） */
  cacheFrame?: boolean;
}

export const DATE_STAMP_HEIGHT = 3.1;

/** 窓をちょうど覆う倍率（写真1px → mm） */
export function coverScale(win: Rect, imgW: number, imgH: number): number {
  return Math.max(win.w / imgW, win.h / imgH);
}

function applyPhotoTransform(ctx: CanvasRenderingContext2D, win: Rect, t: PhotoTransform, w: number, h: number) {
  const s = coverScale(win, w, h) * t.scale;
  ctx.translate(win.x + win.w / 2 + t.x, win.y + win.h / 2 + t.y);
  ctx.rotate(t.rotation);
  ctx.scale(t.flipX ? -s : s, s);
}

function drawPhoto(ctx: CanvasRenderingContext2D, win: Rect, t: PhotoTransform, photo: PhotoSource) {
  ctx.save();
  applyPhotoTransform(ctx, win, t, photo.width, photo.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(photo.image, -photo.width / 2, -photo.height / 2, photo.width, photo.height);
  ctx.restore();
}

// ---- フレーム背景（プレビューでは使い回す） ----
let frameCache: { key: string; canvas: HTMLCanvasElement } | null = null;

function paintFrame(ctx: CanvasRenderingContext2D, shape: FrameShape, styleId: string) {
  const style = getFrameStyle(styleId);
  ctx.fillStyle = style.base;
  ctx.fillRect(0, 0, shape.width, shape.height);
  if (style.draw) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, shape.width, shape.height);
    ctx.clip();
    style.draw(ctx, shape.width, shape.height);
    ctx.restore();
  }
  drawPaperTexture(ctx, shape.width, shape.height);
}

function drawFrame(ctx: CanvasRenderingContext2D, shape: FrameShape, styleId: string, pxPerMm: number, cache: boolean) {
  if (!cache) {
    paintFrame(ctx, shape, styleId);
    return;
  }
  const key = `${shape.id}|${styleId}|${pxPerMm.toFixed(4)}`;
  if (!frameCache || frameCache.key !== key) {
    const c = createCanvas(shape.width * pxPerMm, shape.height * pxPerMm);
    const cctx = get2d(c);
    cctx.scale(pxPerMm, pxPerMm);
    paintFrame(cctx, shape, styleId);
    if (frameCache) {
      frameCache.canvas.width = 0;
      frameCache.canvas.height = 0;
    }
    frameCache = { key, canvas: c };
  }
  ctx.drawImage(frameCache.canvas, 0, 0, shape.width, shape.height);
}

// ---- レイヤー ----
function contrastColor(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return '#ffffff';
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => parseInt(v, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#2a2a2a' : '#ffffff';
}

function drawTextLayer(ctx: CanvasRenderingContext2D, layer: TextLayer, pxPerMm: number) {
  if (!layer.text) return;
  const font = getFont(layer.fontId);
  const px = layer.size * pxPerMm;
  ctx.save();
  ctx.translate(layer.x, layer.y);
  ctx.rotate(layer.rotation);
  // 文字はピクセル単位の座標で描く（小さい文字サイズを拡大して描くと崩れるブラウザがあるため）
  ctx.scale(1 / pxPerMm, 1 / pxPerMm);
  ctx.font = canvasFont(font, px);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = textLines(layer.text);
  const lh = px * font.lineHeight;
  const y0 = -((lines.length - 1) * lh) / 2;

  if (layer.style === 'outline') {
    ctx.lineJoin = 'round';
    ctx.lineWidth = px * 0.2;
    ctx.strokeStyle = contrastColor(layer.color);
    lines.forEach((line, i) => ctx.strokeText(line, 0, y0 + i * lh));
  } else if (layer.style === 'shadow') {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = px * 0.18;
    ctx.shadowOffsetY = px * 0.06;
  }
  ctx.fillStyle = layer.color;
  lines.forEach((line, i) => ctx.fillText(line, 0, y0 + i * lh));
  ctx.restore();
}

function drawStampLayer(ctx: CanvasRenderingContext2D, layer: StampLayer) {
  const stamp = getStamp(layer.stampId);
  ctx.save();
  ctx.translate(layer.x, layer.y);
  ctx.rotate(layer.rotation);
  const k = layer.size / 100;
  ctx.scale(k, k);
  stamp.render(ctx, layer.color);
  ctx.restore();
}

export function drawLayer(ctx: CanvasRenderingContext2D, layer: Layer, pxPerMm: number) {
  if (layer.kind === 'text') drawTextLayer(ctx, layer, pxPerMm);
  else drawStampLayer(ctx, layer);
}

function drawSelection(ctx: CanvasRenderingContext2D, layer: Layer, ui: number) {
  const { w, h } = layerSize(layer);
  const pad = ui * SELECTION_PAD_PX;
  ctx.save();
  ctx.translate(layer.x, layer.y);
  ctx.rotate(layer.rotation);
  ctx.lineWidth = ui * 1.5;
  ctx.setLineDash([ui * 5, ui * 4]);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2);
  ctx.setLineDash([ui * 5, ui * 4]);
  ctx.lineDashOffset = ui * 5;
  ctx.strokeStyle = 'rgba(40,40,40,0.9)';
  ctx.strokeRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2);
  ctx.restore();

  const handles = selectionHandles(layer, pad);
  const r = ui * HANDLE_RADIUS_PX;
  // 拡大・回転のつまみ
  ctx.save();
  ctx.fillStyle = '#ff7a59';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = ui * 2;
  ctx.beginPath();
  ctx.arc(handles.transform.x, handles.transform.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = ui * 2;
  ctx.beginPath();
  ctx.arc(handles.transform.x, handles.transform.y, r * 0.5, -Math.PI * 0.9, Math.PI * 0.4);
  ctx.stroke();
  // 削除のつまみ
  ctx.fillStyle = '#444444';
  ctx.beginPath();
  ctx.arc(handles.remove.x, handles.remove.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  const k = r * 0.38;
  ctx.beginPath();
  ctx.moveTo(handles.remove.x - k, handles.remove.y - k);
  ctx.lineTo(handles.remove.x + k, handles.remove.y + k);
  ctx.moveTo(handles.remove.x + k, handles.remove.y - k);
  ctx.lineTo(handles.remove.x - k, handles.remove.y + k);
  ctx.stroke();
  ctx.restore();
}

/** 選択枠のつまみの余白（UI単位）。当たり判定でも使う */
export const SELECTION_PAD_PX = 6;
export const HANDLE_RADIUS_PX = 13;

/**
 * ドキュメントを描く。ctx の大きさは (フレーム幅 × pxPerMm, フレーム高さ × pxPerMm) を想定。
 */
export function renderDocument(ctx: CanvasRenderingContext2D, doc: PhotoDoc, photo: PhotoSource | null, opts: RenderOptions) {
  const shape = FRAME_SHAPES[doc.frame.shapeId];
  const win = shape.window;
  const { pxPerMm } = opts;

  ctx.save();
  ctx.setTransform(pxPerMm, 0, 0, pxPerMm, 0, 0);

  drawFrame(ctx, shape, doc.frame.styleId, pxPerMm, !!opts.cacheFrame);

  // ---- 窓の中（写真と効果） ----
  ctx.save();
  ctx.beginPath();
  ctx.rect(win.x, win.y, win.w, win.h);
  ctx.clip();
  ctx.fillStyle = '#161616';
  ctx.fillRect(win.x, win.y, win.w, win.h);
  if (photo) drawPhoto(ctx, win, doc.photo, photo);
  const fx = doc.effects;
  drawLightLeak(ctx, win, fx.lightLeak, fx.lightLeakStrength);
  drawVignette(ctx, win, fx.vignette);
  drawGrain(ctx, win, fx.grain);
  ctx.restore();

  // 窓のふちの影（少し奥まって見えるように）
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 0.25;
  ctx.strokeRect(win.x + 0.125, win.y + 0.125, win.w - 0.25, win.h - 0.25);
  ctx.restore();

  // ---- 日付の刻印 ----
  const ds = doc.dateStamp;
  if (ds.enabled) {
    const text = formatDateStamp(ds.date, ds.format);
    const h = DATE_STAMP_HEIGHT;
    const inset = 3;
    let x = win.x + win.w - inset;
    let y = win.y + win.h - inset;
    let align: 'left' | 'right' = 'right';
    if (ds.position === 'bl') {
      x = win.x + inset;
      align = 'left';
    } else if (ds.position === 'tr') {
      y = win.y + inset + h;
    } else if (ds.position === 'margin') {
      x = shape.width - 5;
      y = shape.height - 4.5;
    }
    ctx.save();
    if (ds.position !== 'margin') {
      ctx.beginPath();
      ctx.rect(win.x, win.y, win.w, win.h);
      ctx.clip();
    }
    drawDateStamp(ctx, text, x, y, h, ds.color, align, pxPerMm);
    ctx.restore();
  }

  // ---- 文字・スタンプ ----
  for (const layer of doc.layers) drawLayer(ctx, layer, pxPerMm);

  // ---- 窓からはみ出した写真（操作中のみ） ----
  if (opts.showPhotoOverflow && photo) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-1000, -1000, 3000, 3000);
    ctx.rect(win.x, win.y, win.w, win.h);
    ctx.clip('evenodd');
    ctx.globalAlpha = 0.35;
    drawPhoto(ctx, win, doc.photo, photo);
    ctx.restore();
    ctx.save();
    applyPhotoTransform(ctx, win, doc.photo, photo.width, photo.height);
    const s = coverScale(win, photo.width, photo.height) * doc.photo.scale;
    ctx.lineWidth = (opts.uiMmPerPx ?? 0.1) / s;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.strokeRect(-photo.width / 2, -photo.height / 2, photo.width, photo.height);
    ctx.restore();
  }

  // ---- 選択枠 ----
  if (opts.selectedLayerId) {
    const layer = doc.layers.find((l) => l.id === opts.selectedLayerId);
    if (layer) drawSelection(ctx, layer, opts.uiMmPerPx ?? 0.1);
  }

  ctx.restore();
}

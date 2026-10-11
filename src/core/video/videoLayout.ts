import { MAX_VIDEO_SECONDS, MIN_VIDEO_SECONDS } from '../../config';
import { FRAME_SHAPES } from '../frames/shapes';
import type { FrameShapeId, VideoAspect, VideoSettings } from '../model/types';

/**
 * 動画の形や使う範囲を決める計算（端末にも画面にも依存しない）。
 */

export const VIDEO_ASPECT_SIZES: Record<Exclude<VideoAspect, 'film'>, { w: number; h: number }> = {
  '9:16': { w: 1080, h: 1920 },
  '4:5': { w: 1080, h: 1350 },
  '1:1': { w: 1080, h: 1080 },
  '16:9': { w: 1920, h: 1080 },
};

export const VIDEO_ASPECTS_A: VideoAspect[] = ['film', '9:16', '4:5', '1:1', '16:9'];
export const VIDEO_ASPECTS_B: Exclude<VideoAspect, 'film'>[] = ['9:16', '4:5', '1:1', '16:9'];

export function aspectLabel(a: VideoAspect): string {
  return a === 'film' ? 'フィルムの形そのまま' : a;
}

/** 書き出す動画の大きさ（px）。H.264 のため偶数にそろえる */
export function videoOutputSize(aspect: VideoAspect, shapeId: FrameShapeId): { w: number; h: number } {
  if (aspect !== 'film') return VIDEO_ASPECT_SIZES[aspect];
  const s = FRAME_SHAPES[shapeId];
  // 横長（ワイド）は高さを1080に、それ以外は幅を1080にする
  if (s.width > s.height) return { w: Math.round((1080 * s.width) / s.height / 2) * 2, h: 1080 };
  return { w: 1080, h: Math.round((1080 * s.height) / s.width / 2) * 2 };
}

/** 動画の向き（表示したときの幅・高さ）から、最初に使うフレームの形と、モードBの動画の形を決める */
export function autoVideoLayout(displayW: number, displayH: number): {
  shapeId: FrameShapeId;
  aspectB: Exclude<VideoAspect, 'film'>;
} {
  const r = displayW > 0 && displayH > 0 ? displayW / displayH : 9 / 16;
  const shapeId: FrameShapeId = r > 1.2 ? 'wide' : r < 0.83 ? 'mini' : 'square';
  let aspectB = VIDEO_ASPECTS_B[0];
  let best = Infinity;
  for (const a of VIDEO_ASPECTS_B) {
    const { w, h } = VIDEO_ASPECT_SIZES[a];
    const d = Math.abs(Math.log(w / h / r));
    if (d < best) {
      best = d;
      aspectB = a;
    }
  }
  return { shapeId, aspectB };
}

/** 動画を読み込んだときの最初の設定（すべて元の動画に合わせる） */
export function createVideoSettings(displayW: number, displayH: number, duration: number): VideoSettings {
  const { aspectB } = autoVideoLayout(displayW, displayH);
  return {
    mode: 'A',
    aspectA: 'film',
    aspectB,
    thumbTime: null,
    trimStart: 0,
    trimEnd: Math.min(duration, MAX_VIDEO_SECONDS),
  };
}

/** 使う範囲を、動画の長さ・上限・最短に収める。changed は動かした側（もう片方を合わせる） */
export function clampTrim(
  start: number,
  end: number,
  duration: number,
  changed: 'start' | 'end',
): { trimStart: number; trimEnd: number } {
  const minLen = Math.min(MIN_VIDEO_SECONDS, duration);
  let s = Math.max(0, Math.min(start, duration - minLen));
  let e = Math.max(minLen, Math.min(end, duration));
  if (changed === 'start') {
    if (e - s < minLen) e = Math.min(duration, s + minLen);
    if (e - s > MAX_VIDEO_SECONDS) e = s + MAX_VIDEO_SECONDS;
  } else {
    if (e - s < minLen) s = Math.max(0, e - minLen);
    if (e - s > MAX_VIDEO_SECONDS) s = e - MAX_VIDEO_SECONDS;
  }
  return { trimStart: s, trimEnd: e };
}

/** サムネに使う時刻（未設定や範囲外なら、使う範囲の始まり） */
export function effectiveThumbTime(v: VideoSettings): number {
  const t = v.thumbTime;
  if (t === null || t < v.trimStart || t > v.trimEnd) return v.trimStart;
  return t;
}

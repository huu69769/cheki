import type { FrameShapeId, Rect } from '../model/types';

export interface FrameShape {
  id: FrameShapeId;
  label: string;
  /** フレーム全体の大きさ（mm） */
  width: number;
  height: number;
  /** 写真が入る窓（mm） */
  window: Rect;
}

/**
 * 一般的なインスタントフィルムの比率を参考にした寸法。
 * 3種類とも高さを 86mm にそろえているので、形を切り替えても文字などの縦位置がずれない。
 */
export const FRAME_SHAPES: Record<FrameShapeId, FrameShape> = {
  mini: {
    id: 'mini',
    label: 'ミニ',
    width: 54,
    height: 86,
    window: { x: 4, y: 6.5, w: 46, h: 62 },
  },
  square: {
    id: 'square',
    label: 'スクエア',
    width: 72,
    height: 86,
    window: { x: 5, y: 6.5, w: 62, h: 62 },
  },
  wide: {
    id: 'wide',
    label: 'ワイド',
    width: 108,
    height: 86,
    window: { x: 4.5, y: 6.5, w: 99, h: 62 },
  },
};

export const FRAME_SHAPE_LIST: FrameShape[] = [FRAME_SHAPES.mini, FRAME_SHAPES.square, FRAME_SHAPES.wide];

/** 下の余白の中心（文字を置く既定位置） */
export function marginCenter(shape: FrameShape): { x: number; y: number } {
  const top = shape.window.y + shape.window.h;
  return { x: shape.width / 2, y: top + (shape.height - top) / 2 };
}

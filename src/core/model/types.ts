/**
 * 編集データ（ドキュメント）の型。
 * 単位はすべて「mm」。フレーム左上を原点とする座標系。
 * UIや端末に依存しない純粋なデータなので、そのまま下書き（IndexedDB）に保存できる。
 */

export type FrameShapeId = 'mini' | 'square' | 'wide';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 窓（写真が入る部分）の中での写真の位置・拡大・回転 */
export interface PhotoTransform {
  /** 窓の中心からのずれ（mm） */
  x: number;
  y: number;
  /** 窓をちょうど覆う大きさを 1 とした倍率 */
  scale: number;
  /** ラジアン */
  rotation: number;
  /** 左右反転 */
  flipX: boolean;
}

export type TextStyleKind = 'plain' | 'outline' | 'shadow';

export interface TextLayer {
  kind: 'text';
  id: string;
  text: string;
  fontId: string;
  color: string;
  /** 文字の高さ（mm） */
  size: number;
  /** 中心位置（mm, フレーム座標） */
  x: number;
  y: number;
  rotation: number;
  style: TextStyleKind;
}

export interface StampLayer {
  kind: 'stamp';
  id: string;
  stampId: string;
  color: string;
  /** 幅（mm） */
  size: number;
  x: number;
  y: number;
  rotation: number;
}

export type Layer = TextLayer | StampLayer;

export type LightLeakId = 'none' | 'warm' | 'pink' | 'rainbow' | 'sun';

export interface EffectSettings {
  filterId: string;
  /** 0〜1 */
  filterStrength: number;
  grain: number;
  vignette: number;
  lightLeak: LightLeakId;
  lightLeakStrength: number;
}

export type DateFormatId = 'yy-mm-dd' | 'yyyy-mm-dd' | 'mm-dd-yy' | 'dd-mm-yy';
export type DatePosition = 'br' | 'bl' | 'tr' | 'margin';

export interface DateStampSettings {
  enabled: boolean;
  /** YYYY-MM-DD */
  date: string;
  format: DateFormatId;
  position: DatePosition;
  color: string;
}

export interface PhotoDoc {
  version: 1;
  frame: {
    shapeId: FrameShapeId;
    styleId: string;
  };
  photo: PhotoTransform;
  effects: EffectSettings;
  dateStamp: DateStampSettings;
  /** 後ろにあるものほど手前に描かれる */
  layers: Layer[];
}

/**
 * 文字入れで使うフォントの一覧。
 * フォント本体は @fontsource（Google Fonts と同じ OFL / Apache ライセンスのフォント）を同梱し、
 * CSS の unicode-range で細かく分割されているため、実際に使った文字を含むファイルだけが読み込まれる。
 * （fonts.css で @font-face を読み込み、ここでは名前と描画用の指定だけを持つ）
 */

export interface FontDef {
  id: string;
  label: string;
  family: string;
  weight: number;
  /** 一覧に表示する見本の文字 */
  sample: string;
  /** 文字の上下の詰まり具合の補正（行の高さの倍率） */
  lineHeight: number;
}

export const SYSTEM_FALLBACK = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Noto Sans CJK JP", sans-serif';

export const FONTS: FontDef[] = [
  { id: 'yomogi', label: 'よもぎ（手書き）', family: 'Yomogi', weight: 400, sample: 'あいうえお', lineHeight: 1.3 },
  { id: 'klee', label: 'クレー（手書き）', family: 'Klee One', weight: 600, sample: 'あいうえお', lineHeight: 1.3 },
  { id: 'kurenaido', label: 'くれないど（筆ペン）', family: 'Zen Kurenaido', weight: 400, sample: 'あいうえお', lineHeight: 1.3 },
  { id: 'hachimaru', label: 'はちまる（丸文字）', family: 'Hachi Maru Pop', weight: 400, sample: 'あいうえお', lineHeight: 1.45 },
  { id: 'zenmaru', label: '丸ゴシック', family: 'Zen Maru Gothic', weight: 700, sample: 'あいうえお', lineHeight: 1.3 },
  { id: 'dot', label: 'ドット', family: 'DotGothic16', weight: 400, sample: 'あいうえお', lineHeight: 1.3 },
  { id: 'system', label: 'ゴシック（標準）', family: '', weight: 700, sample: 'あいうえお', lineHeight: 1.3 },
  { id: 'caveat', label: 'Caveat', family: 'Caveat', weight: 600, sample: 'Hello!', lineHeight: 1.2 },
  { id: 'pacifico', label: 'Pacifico', family: 'Pacifico', weight: 400, sample: 'Hello!', lineHeight: 1.5 },
  { id: 'marker', label: 'Marker', family: 'Permanent Marker', weight: 400, sample: 'Hello!', lineHeight: 1.3 },
];

export const DEFAULT_FONT_ID = 'yomogi';

export function getFont(id: string): FontDef {
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}

/** CSS / Canvas 用の font-family 指定 */
export function fontFamilyCss(font: FontDef): string {
  return font.family ? `"${font.family}", ${SYSTEM_FALLBACK}` : SYSTEM_FALLBACK;
}

/** Canvas の ctx.font に渡す文字列 */
export function canvasFont(font: FontDef, px: number): string {
  return `${font.weight} ${px}px ${fontFamilyCss(font)}`;
}

/**
 * 指定した文字を描くのに必要なフォントファイルを読み込む。
 * unicode-range で分割されているので、使う文字の分だけ読み込まれる。
 */
export async function ensureFontLoaded(font: FontDef, text: string): Promise<void> {
  if (!font.family || typeof document === 'undefined' || !document.fonts) return;
  try {
    await document.fonts.load(`${font.weight} 32px "${font.family}"`, text || font.sample);
  } catch {
    // 読み込めなくても代わりのフォントで描画されるので無視する
  }
}

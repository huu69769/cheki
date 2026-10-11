/**
 * レトロな色味のフィルター。
 * Safari の Canvas は ctx.filter に対応していない時期があったため、画素を直接計算して色を変える。
 */

export interface FilterParams {
  brightness?: number; // -1〜1 の加算
  contrast?: number; // 1 = 変化なし
  saturation?: number; // 1 = 変化なし、0 = モノクロ
  temperature?: number; // + で暖色、- で寒色
  tint?: number; // + でマゼンタ寄り、- でグリーン寄り
  sepia?: number; // 0〜1
  fade?: number; // 黒を持ち上げる量 0〜0.3
  shadows?: [number, number, number]; // 暗部に足す色（-1〜1）
  highlights?: [number, number, number]; // 明部に足す色
}

export interface FilterDef {
  id: string;
  label: string;
  params: FilterParams;
}

export const FILTERS: FilterDef[] = [
  { id: 'none', label: 'なし', params: {} },
  {
    id: 'film',
    label: 'フィルム',
    params: {
      contrast: 1.08,
      saturation: 0.9,
      temperature: 0.15,
      fade: 0.06,
      shadows: [-0.02, 0.03, 0.05],
      highlights: [0.05, 0.03, -0.03],
    },
  },
  {
    id: 'nostalgia',
    label: 'ノスタルジー',
    params: { contrast: 0.95, saturation: 0.8, temperature: 0.55, fade: 0.1, highlights: [0.06, 0.03, -0.04] },
  },
  {
    id: 'faded',
    label: '色あせ',
    params: { contrast: 0.85, saturation: 0.6, fade: 0.18, tint: 0.1, shadows: [0, 0.03, 0.06], brightness: 0.03 },
  },
  { id: 'sepia', label: 'セピア', params: { sepia: 1, contrast: 1.05, fade: 0.05 } },
  { id: 'mono', label: 'モノクロ', params: { saturation: 0, contrast: 1.15, fade: 0.03 } },
  {
    id: 'cool',
    label: 'クール',
    params: { temperature: -0.5, saturation: 0.9, fade: 0.05, contrast: 1.02, shadows: [-0.02, 0.01, 0.06] },
  },
  { id: 'vivid', label: 'ビビッド', params: { saturation: 1.35, contrast: 1.12 } },
  {
    id: 'soft',
    label: 'ソフト',
    params: { brightness: 0.06, contrast: 0.85, saturation: 0.85, fade: 0.1, highlights: [0.05, 0.0, 0.03] },
  },
];

export function getFilter(id: string): FilterDef {
  return FILTERS.find((f) => f.id === id) ?? FILTERS[0];
}

/** ImageData をそのまま書き換える。strength は 0〜1 */
export function applyFilterToImageData(data: Uint8ClampedArray, params: FilterParams, strength: number): void {
  if (strength <= 0 || Object.keys(params).length === 0) return;
  const b = params.brightness ?? 0;
  const c = params.contrast ?? 1;
  const s = params.saturation ?? 1;
  const t = params.temperature ?? 0;
  const ti = params.tint ?? 0;
  const sep = params.sepia ?? 0;
  const fade = params.fade ?? 0;
  const sh = params.shadows ?? [0, 0, 0];
  const hi = params.highlights ?? [0, 0, 0];
  const k = strength;
  const inv = 1 / 255;

  for (let i = 0; i < data.length; i += 4) {
    const r0 = data[i] * inv;
    const g0 = data[i + 1] * inv;
    const b0 = data[i + 2] * inv;
    let r = r0 + b;
    let g = g0 + b;
    let bl = b0 + b;

    // コントラスト
    r = (r - 0.5) * c + 0.5;
    g = (g - 0.5) * c + 0.5;
    bl = (bl - 0.5) * c + 0.5;

    // 彩度
    const lum = 0.299 * r + 0.587 * g + 0.114 * bl;
    r = lum + (r - lum) * s;
    g = lum + (g - lum) * s;
    bl = lum + (bl - lum) * s;

    // セピア
    if (sep > 0) {
      const sr = 0.393 * r + 0.769 * g + 0.189 * bl;
      const sg = 0.349 * r + 0.686 * g + 0.168 * bl;
      const sb = 0.272 * r + 0.534 * g + 0.131 * bl;
      r += (sr - r) * sep;
      g += (sg - g) * sep;
      bl += (sb - bl) * sep;
    }

    // 色温度・色かぶり
    r += t * 0.08;
    bl -= t * 0.08;
    g -= ti * 0.04;

    // 暗部・明部の色づけ
    const l2 = Math.min(1, Math.max(0, lum));
    const ws = (1 - l2) * (1 - l2);
    const wh = l2 * l2;
    r += sh[0] * ws + hi[0] * wh;
    g += sh[1] * ws + hi[1] * wh;
    bl += sh[2] * ws + hi[2] * wh;

    // 色あせ（黒を持ち上げ、白を少し下げる）
    if (fade > 0) {
      const scale = 1 - fade * 1.4;
      r = fade + r * scale;
      g = fade + g * scale;
      bl = fade + bl * scale;
    }

    // 元の色と強さで混ぜる
    data[i] = (r0 + (r - r0) * k) * 255;
    data[i + 1] = (g0 + (g - g0) * k) * 255;
    data[i + 2] = (b0 + (bl - b0) * k) * 255;
  }
}

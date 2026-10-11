import { describe, expect, it } from 'vitest';
import { autoVideoLayout, clampTrim, createVideoSettings, effectiveThumbTime, videoOutputSize } from './videoLayout';

describe('videoLayout', () => {
  it('動画の向きに合わせてフレームと形を選ぶ', () => {
    expect(autoVideoLayout(1080, 1920)).toEqual({ shapeId: 'mini', aspectB: '9:16' });
    expect(autoVideoLayout(1920, 1080)).toEqual({ shapeId: 'wide', aspectB: '16:9' });
    expect(autoVideoLayout(1080, 1080)).toEqual({ shapeId: 'square', aspectB: '1:1' });
  });

  it('フィルムの形そのままの大きさは偶数', () => {
    const mini = videoOutputSize('film', 'mini');
    expect(mini.w).toBe(1080);
    expect(mini.h % 2).toBe(0);
    const wide = videoOutputSize('film', 'wide');
    expect(wide.h).toBe(1080);
    expect(wide.w % 2).toBe(0);
  });

  it('60秒より長い動画は最初の60秒を使う', () => {
    const v = createVideoSettings(1080, 1920, 95);
    expect(v.trimStart).toBe(0);
    expect(v.trimEnd).toBe(60);
  });

  it('使う範囲は上限と最短に収まる', () => {
    expect(clampTrim(10, 100, 120, 'start')).toEqual({ trimStart: 10, trimEnd: 70 });
    expect(clampTrim(0, 90, 120, 'end')).toEqual({ trimStart: 30, trimEnd: 90 });
    expect(clampTrim(5, 5.2, 30, 'start')).toEqual({ trimStart: 5, trimEnd: 6 });
  });

  it('サムネは範囲外なら使う範囲の始まり', () => {
    const v = { ...createVideoSettings(1080, 1920, 30), trimStart: 5, trimEnd: 20 };
    expect(effectiveThumbTime({ ...v, thumbTime: null })).toBe(5);
    expect(effectiveThumbTime({ ...v, thumbTime: 2 })).toBe(5);
    expect(effectiveThumbTime({ ...v, thumbTime: 8 })).toBe(8);
  });
});

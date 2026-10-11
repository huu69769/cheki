import { describe, expect, it } from 'vitest';
import { createHistory, pushHistory, redoHistory, undoHistory } from './history';

describe('history', () => {
  it('元に戻す・やり直しができる', () => {
    let h = createHistory(1);
    h = pushHistory(h, 2, null, 0);
    h = pushHistory(h, 3, null, 10);
    expect(h.present).toBe(3);
    h = undoHistory(h);
    expect(h.present).toBe(2);
    h = undoHistory(h);
    expect(h.present).toBe(1);
    h = undoHistory(h);
    expect(h.present).toBe(1);
    h = redoHistory(h);
    expect(h.present).toBe(2);
  });

  it('同じ mergeKey の連続した変更は1回分にまとまる', () => {
    let h = createHistory(0);
    h = pushHistory(h, 1, 'drag', 0);
    h = pushHistory(h, 2, 'drag', 100);
    h = pushHistory(h, 3, 'drag', 200);
    expect(h.past).toEqual([0]);
    h = undoHistory(h);
    expect(h.present).toBe(0);
  });

  it('新しい変更をするとやり直しの履歴は消える', () => {
    let h = createHistory(0);
    h = pushHistory(h, 1, null, 0);
    h = undoHistory(h);
    h = pushHistory(h, 5, null, 10);
    expect(h.future).toEqual([]);
    expect(redoHistory(h).present).toBe(5);
  });
});

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FRAME_SHAPES } from '../../core/frames/shapes';
import type { Layer, PhotoDoc } from '../../core/model/types';
import { removeLayer, updateLayer } from '../../core/model/doc';
import { fitPhotoToWindow } from '../../core/model/photoFit';
import { hitTestLayers, selectionHandles } from '../../core/render/geometry';
import { PreviewPhotoCache, type LoadedPhoto } from '../../core/render/photoSource';
import { HANDLE_RADIUS_PX, SELECTION_PAD_PX, renderDocument } from '../../core/render/renderer';

export type ApplyFn = (fn: (d: PhotoDoc) => PhotoDoc, mergeKey?: string) => void;

interface Props {
  doc: PhotoDoc;
  photo: LoadedPhoto;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  apply: ApplyFn;
  /** すでに選ばれている文字をタップしたとき */
  onTapSelectedText: (id: string) => void;
  /** フォントの読み込みが終わるたびに増える（再描画のきっかけ） */
  fontsVersion: number;
}

interface Pt {
  x: number;
  y: number;
}

interface TargetSnapshot {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

type GestureTarget = { kind: 'photo' } | { kind: 'layer'; id: string };

interface Gesture {
  target: GestureTarget;
  mode: 'drag' | 'pinch' | 'handle';
  key: string;
  startPts: Pt[];
  snap: TargetSnapshot;
  moved: boolean;
  startTime: number;
  wasSelected: boolean;
}

const MIN_LAYER = 1.5;
const MAX_LAYER = 140;
const MIN_PHOTO_SCALE = 0.3;
const MAX_PHOTO_SCALE = 8;

/** 0°・90°などの近くでは、その角度にぴったり合わせる */
function snapAngle(a: number): number {
  const step = Math.PI / 2;
  const nearest = Math.round(a / step) * step;
  return Math.abs(a - nearest) < (3 * Math.PI) / 180 ? nearest : a;
}

let gestureCounter = 0;

export function Stage({ doc, photo, selectedId, onSelect, apply, onTapSelectedText, fontsVersion }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<PreviewPhotoCache | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [overflow, setOverflow] = useState(false);

  const shape = FRAME_SHAPES[doc.frame.shapeId];

  // 最新の値をイベント処理から参照するため
  const docRef = useRef(doc);
  docRef.current = doc;
  const selRef = useRef(selectedId);
  selRef.current = selectedId;

  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<Gesture | null>(null);

  useEffect(() => {
    cacheRef.current = new PreviewPhotoCache();
    return () => cacheRef.current?.dispose();
  }, []);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // 表示サイズ（CSS px）：余白を残してフレームが収まる大きさ
  const margin = 20;
  const availW = Math.max(50, box.w - margin * 2);
  const availH = Math.max(50, box.h - margin * 2);
  const cssScale = Math.min(availW / shape.width, availH / shape.height); // CSS px / mm
  const cssW = Math.floor(shape.width * cssScale);
  const cssH = Math.floor(shape.height * cssScale);

  // 描画
  useEffect(() => {
    const canvas = canvasRef.current;
    const cache = cacheRef.current;
    if (!canvas || !cache || box.w === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    const id = requestAnimationFrame(() => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const src = cache.get(photo, doc.effects.filterId, doc.effects.filterStrength);
      const pxPerMm = pw / shape.width;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, pw, ph);
      renderDocument(ctx, doc, src, {
        pxPerMm,
        selectedLayerId: selectedId,
        showPhotoOverflow: overflow,
        uiMmPerPx: 1 / cssScale,
        cacheFrame: true,
      });
    });
    return () => cancelAnimationFrame(id);
  }, [doc, photo, selectedId, overflow, cssW, cssH, cssScale, shape.width, box.w, fontsVersion]);

  // ---- 指の操作 ----
  const toMm = (e: { clientX: number; clientY: number }): Pt => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * shape.width,
      y: ((e.clientY - rect.top) / rect.height) * shape.height,
    };
  };

  const snapshotOf = (target: GestureTarget): TargetSnapshot | null => {
    const d = docRef.current;
    if (target.kind === 'photo') {
      return { x: d.photo.x, y: d.photo.y, scale: d.photo.scale, rotation: d.photo.rotation };
    }
    const l = d.layers.find((x) => x.id === target.id);
    if (!l) return null;
    return { x: l.x, y: l.y, scale: l.size, rotation: l.rotation };
  };

  const writeTarget = (g: Gesture, next: TargetSnapshot) => {
    if (g.target.kind === 'photo') {
      const scale = Math.min(MAX_PHOTO_SCALE, Math.max(MIN_PHOTO_SCALE, next.scale));
      apply(
        (d) => ({ ...d, photo: { ...d.photo, x: next.x, y: next.y, scale, rotation: snapAngle(next.rotation) } }),
        g.key,
      );
    } else {
      const id = g.target.id;
      const size = Math.min(MAX_LAYER, Math.max(MIN_LAYER, next.scale));
      // 横方向の中央に近ければ中央に合わせる
      const cx = shape.width / 2;
      const x = Math.abs(next.x - cx) < 0.8 ? cx : next.x;
      apply((d) => updateLayer(d, id, { x, y: next.y, size, rotation: snapAngle(next.rotation) } as Partial<Layer>), g.key);
    }
  };

  const restartGesture = (g: Gesture) => {
    const snap = snapshotOf(g.target);
    if (!snap) return;
    g.snap = snap;
    g.startPts = [...pointers.current.values()].slice(0, 2);
    g.mode = g.startPts.length >= 2 ? 'pinch' : g.mode === 'handle' ? 'handle' : 'drag';
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toMm(e);
    pointers.current.set(e.pointerId, p);

    if (pointers.current.size === 1) {
      const d = docRef.current;
      const ui = 1 / cssScale; // 画面上の 1px が何 mm か
      const sel = d.layers.find((l) => l.id === selRef.current) ?? null;
      const key = `gesture-${++gestureCounter}`;
      if (sel) {
        const h = selectionHandles(sel, ui * SELECTION_PAD_PX);
        const r = ui * HANDLE_RADIUS_PX * 1.5;
        if (Math.hypot(p.x - h.remove.x, p.y - h.remove.y) <= r) {
          apply((doc0) => removeLayer(doc0, sel.id));
          onSelect(null);
          gesture.current = null;
          pointers.current.clear();
          return;
        }
        if (Math.hypot(p.x - h.transform.x, p.y - h.transform.y) <= r) {
          gesture.current = {
            target: { kind: 'layer', id: sel.id },
            mode: 'handle',
            key,
            startPts: [p],
            snap: { x: sel.x, y: sel.y, scale: sel.size, rotation: sel.rotation },
            moved: true,
            startTime: performance.now(),
            wasSelected: true,
          };
          return;
        }
      }
      const hit = hitTestLayers(d, p.x, p.y, ui * 8);
      const target: GestureTarget = hit ? { kind: 'layer', id: hit.id } : { kind: 'photo' };
      const wasSelected = !!hit && hit.id === selRef.current;
      if (hit) {
        if (!wasSelected) onSelect(hit.id);
      } else if (selRef.current) {
        onSelect(null);
      }
      const snap = snapshotOf(target);
      if (!snap) return;
      gesture.current = {
        target,
        mode: 'drag',
        key,
        startPts: [p],
        snap,
        moved: false,
        startTime: performance.now(),
        wasSelected,
      };
    } else if (gesture.current && pointers.current.size === 2) {
      gesture.current.moved = true;
      restartGesture(gesture.current);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = toMm(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    const pts = [...pointers.current.values()];

    if (g.mode === 'drag') {
      const s = g.startPts[0];
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      if (!g.moved && Math.hypot(dx, dy) * cssScale < 5) return;
      if (!g.moved) {
        g.moved = true;
        if (g.target.kind === 'photo') setOverflow(true);
      }
      writeTarget(g, { ...g.snap, x: g.snap.x + dx, y: g.snap.y + dy });
    } else if (g.mode === 'pinch' && pts.length >= 2 && g.startPts.length >= 2) {
      if (g.target.kind === 'photo') setOverflow(true);
      const [a0, b0] = g.startPts;
      const [a, b] = pts;
      const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1;
      const d1 = Math.hypot(b.x - a.x, b.y - a.y);
      const ang0 = Math.atan2(b0.y - a0.y, b0.x - a0.x);
      const ang1 = Math.atan2(b.y - a.y, b.x - a.x);
      const c0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
      const c1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      writeTarget(g, {
        x: g.snap.x + (c1.x - c0.x),
        y: g.snap.y + (c1.y - c0.y),
        scale: g.snap.scale * (d1 / d0),
        rotation: g.snap.rotation + (ang1 - ang0),
      });
    } else if (g.mode === 'handle') {
      const s = g.startPts[0];
      const v0 = { x: s.x - g.snap.x, y: s.y - g.snap.y };
      const v1 = { x: p.x - g.snap.x, y: p.y - g.snap.y };
      const l0 = Math.hypot(v0.x, v0.y) || 1;
      const l1 = Math.hypot(v1.x, v1.y);
      writeTarget(g, {
        ...g.snap,
        scale: g.snap.scale * (l1 / l0),
        rotation: g.snap.rotation + Math.atan2(v1.y, v1.x) - Math.atan2(v0.y, v0.x),
      });
    }
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (pointers.current.size > 0) {
      // 2本指から1本指に戻ったら、その指で続けて動かせるようにする
      if (g.mode === 'pinch') {
        g.mode = 'drag';
        restartGesture(g);
      }
      return;
    }
    const isTap = !g.moved && performance.now() - g.startTime < 400;
    if (isTap && g.target.kind === 'layer' && g.wasSelected) {
      const id = g.target.id;
      const layer = docRef.current.layers.find((l) => l.id === id);
      if (layer?.kind === 'text') onTapSelectedText(id);
    }
    if (g.moved && g.target.kind === 'photo') {
      apply((d) => fitPhotoToWindow(d, photo.width, photo.height), g.key);
    }
    gesture.current = null;
    setOverflow(false);
  };

  // iOS Safari のページ全体の拡大（ピンチ）を防ぐ
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const prevent = (ev: Event) => ev.preventDefault();
    el.addEventListener('gesturestart', prevent);
    el.addEventListener('touchmove', prevent, { passive: false });
    return () => {
      el.removeEventListener('gesturestart', prevent);
      el.removeEventListener('touchmove', prevent);
    };
  }, []);

  return (
    <div
      className="stage"
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <canvas
        ref={canvasRef}
        className="stage-canvas"
        style={{ width: cssW, height: cssH }}
        aria-label="編集中の写真。指で動かす、2本指で拡大・回転できます"
      />
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { FRAME_SHAPES } from '../core/frames/shapes';
import type { FrameShapeId, PhotoDoc } from '../core/model/types';
import { renderDocument } from '../core/render/renderer';
import { FramePicker, makeTestDoc } from './videoExportTest';

interface Props {
  file: Blob;
  shapeId: FrameShapeId;
  value: number;
  onChange: (time: number) => void;
}

const STRIP_COUNT = 10;
const PREVIEW_CSS_W = 200;

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

/**
 * 入り込む前に写真として見せる1コマ（サムネ）を選ぶ。
 * 上にコマ割り（等間隔のコマ）、下にフィルムに入れたときの見た目と、細かく選ぶためのスライダー。
 */
export function ThumbPicker({ file, shapeId, value, onChange }: Props) {
  const [picker, setPicker] = useState<FramePicker | null>(null);
  const [duration, setDuration] = useState(0);
  const [strip, setStrip] = useState<{ time: number; url: string }[]>([]);
  const [doc, setDoc] = useState<PhotoDoc | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const p = new FramePicker(file, shapeId, 360);
    setPicker(p);
    setStrip([]);
    let alive = true;
    p.duration.then((d) => alive && setDuration(d));
    const items: { time: number; url: string }[] = [];
    p.strip(STRIP_COUNT, (i, time, canvas) => {
      if (!alive) return;
      items[i] = { time, url: canvas.toDataURL('image/jpeg', 0.7) };
      setStrip([...items]);
    }).catch(() => {});
    makeTestDoc(shapeId).then((d) => alive && setDoc(d));
    return () => {
      alive = false;
      p.dispose();
    };
  }, [file, shapeId]);

  // 選んだコマを、フィルムに入れたときの見た目で表示する（スライダー操作中は少し待ってから）
  useEffect(() => {
    if (!picker || !doc) return;
    let alive = true;
    const timer = window.setTimeout(async () => {
      const frame = await picker.frameAt(value).catch(() => null);
      const c = previewRef.current;
      if (!alive || !frame || !c) return;
      const shape = FRAME_SHAPES[shapeId];
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      c.width = Math.round(PREVIEW_CSS_W * dpr);
      c.height = Math.round((PREVIEW_CSS_W * dpr * shape.height) / shape.width);
      const ctx = c.getContext('2d');
      if (!ctx) return;
      renderDocument(ctx, doc, { image: frame, width: frame.width, height: frame.height }, { pxPerMm: c.width / shape.width });
    }, 120);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [picker, doc, value, shapeId]);

  const win = FRAME_SHAPES[shapeId].window;
  const max = Math.max(0, duration - 0.05);

  return (
    <div className="thumb-picker">
      <div className="filmstrip" role="radiogroup" aria-label="コマを選ぶ">
        {Array.from({ length: STRIP_COUNT }, (_, i) => strip[i]).map((item, i) => (
          <button
            key={i}
            role="radio"
            aria-checked={!!item && Math.abs(item.time - value) < 0.01}
            aria-label={item ? `${fmt(item.time)} のコマ` : '読み込み中'}
            className={`filmstrip-frame ${item && Math.abs(item.time - value) < 0.01 ? 'on' : ''}`}
            style={{ aspectRatio: `${win.w} / ${win.h}` }}
            disabled={!item}
            onClick={() => item && onChange(item.time)}
          >
            {item && <img src={item.url} alt="" />}
          </button>
        ))}
      </div>
      <div className="thumb-detail">
        <canvas ref={previewRef} className="thumb-preview" style={{ width: PREVIEW_CSS_W }} />
        <div className="thumb-controls">
          <p className="hint">コマをタップするか、スライダーで細かく選べます。</p>
          <input
            type="range"
            min={0}
            max={max || 0.1}
            step={0.05}
            value={Math.min(value, max)}
            aria-label="サムネにするコマの時刻"
            onChange={(e) => onChange(Number(e.currentTarget.value))}
          />
          <p className="thumb-time">{fmt(Math.min(value, max))}</p>
        </div>
      </div>
    </div>
  );
}

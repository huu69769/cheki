import { useEffect, useRef } from 'react';
import { FRAME_SHAPE_LIST } from '../../../core/frames/shapes';
import { FRAME_STYLES, type FrameStyle } from '../../../core/frames/styles';
import { changeShape } from '../../../core/model/doc';
import type { PhotoDoc } from '../../../core/model/types';
import type { ApplyFn } from '../Stage';

function FrameSwatch({ style }: { style: FrameStyle }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const size = 44;
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    // 見本は 22mm 四方を切り取って表示
    const mm = 22;
    ctx.setTransform((size * dpr) / mm, 0, 0, (size * dpr) / mm, 0, 0);
    ctx.fillStyle = style.base;
    ctx.fillRect(0, 0, mm, mm);
    style.draw?.(ctx, mm, mm);
  }, [style]);
  return <canvas ref={ref} className="swatch-canvas" />;
}

export function FramePanel({ doc, apply }: { doc: PhotoDoc; apply: ApplyFn }) {
  return (
    <div className="panel">
      <div className="segmented" role="radiogroup" aria-label="フレームの形">
        {FRAME_SHAPE_LIST.map((s) => (
          <button
            key={s.id}
            role="radio"
            aria-checked={doc.frame.shapeId === s.id}
            className={doc.frame.shapeId === s.id ? 'on' : ''}
            onClick={() => apply((d) => changeShape(d, s.id))}
          >
            <span className={`shape-icon shape-${s.id}`} aria-hidden="true" />
            {s.label}
          </button>
        ))}
      </div>
      <div className="h-scroll swatches" role="radiogroup" aria-label="フレームの色・柄">
        {FRAME_STYLES.map((st) => (
          <button
            key={st.id}
            role="radio"
            aria-checked={doc.frame.styleId === st.id}
            className={`swatch ${doc.frame.styleId === st.id ? 'on' : ''}`}
            onClick={() => apply((d) => ({ ...d, frame: { ...d.frame, styleId: st.id } }))}
          >
            <FrameSwatch style={st} />
            <span>{st.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

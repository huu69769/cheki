import { useEffect, useRef, useState } from 'react';
import { FILTERS, type FilterDef } from '../../../core/filters/filters';
import type { PhotoDoc } from '../../../core/model/types';
import { filterCanvasInPlace, resizeCanvas } from '../../../core/render/photoSource';
import { createCanvas, get2d, releaseCanvas } from '../../../core/util/canvas';
import { Slider } from '../../components/Slider';
import type { ApplyFn } from '../Stage';

const THUMB = 112;

/** 見本用：写真の中央を正方形に切り抜いた小さな画像 */
function makeThumbBase(sample: HTMLCanvasElement): HTMLCanvasElement {
  const small = resizeCanvas(sample, THUMB * 2);
  const side = Math.min(small.width, small.height);
  const c = createCanvas(THUMB, THUMB);
  get2d(c).drawImage(small, (small.width - side) / 2, (small.height - side) / 2, side, side, 0, 0, THUMB, THUMB);
  releaseCanvas(small);
  return c;
}

function FilterThumb({ base, filter }: { base: HTMLCanvasElement; filter: FilterDef }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = THUMB;
    c.height = THUMB;
    const ctx = get2d(c, { willReadFrequently: true });
    ctx.drawImage(base, 0, 0);
    filterCanvasInPlace(c, filter.id, 1);
  }, [base, filter]);
  return <canvas ref={ref} />;
}

/** sample：見本に使う画像（写真、または動画のいまのコマ） */
export function FilterPanel({ doc, apply, sample }: { doc: PhotoDoc; apply: ApplyFn; sample: HTMLCanvasElement | null }) {
  const [base, setBase] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!sample) return;
    const b = makeThumbBase(sample);
    setBase(b);
    return () => releaseCanvas(b);
  }, [sample]);
  const fx = doc.effects;
  return (
    <div className="panel">
      <div className="h-scroll filter-thumbs" role="radiogroup" aria-label="フィルター">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="radio"
            aria-checked={fx.filterId === f.id}
            className={`thumb-btn ${fx.filterId === f.id ? 'on' : ''}`}
            onClick={() => apply((d) => ({ ...d, effects: { ...d.effects, filterId: f.id, filterStrength: 1 } }))}
          >
            {base ? <FilterThumb base={base} filter={f} /> : <canvas />}
            <span>{f.label}</span>
          </button>
        ))}
      </div>
      {fx.filterId !== 'none' && (
        <Slider
          label="強さ"
          min={0}
          max={1}
          step={0.05}
          value={fx.filterStrength}
          defaultValue={1}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v, key) => apply((d) => ({ ...d, effects: { ...d.effects, filterStrength: v } }), key)}
        />
      )}
    </div>
  );
}

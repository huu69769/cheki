import { useEffect, useRef } from 'react';
import { bringToFront, createStampLayer, removeLayer, updateLayer } from '../../../core/model/doc';
import type { PhotoDoc, StampLayer } from '../../../core/model/types';
import { STAMPS, type StampDef } from '../../../core/stamps/stamps';
import { ColorRow, TEXT_COLORS } from '../../components/ColorRow';
import { Icon } from '../../components/Icon';
import { Slider } from '../../components/Slider';
import type { ApplyFn } from '../Stage';

const DEG = Math.PI / 180;

function StampIcon({ stamp, color }: { stamp: StampDef; color?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const size = 56;
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const k = (size * dpr) / 120;
    ctx.setTransform(k, 0, 0, k, (size * dpr) / 2, (size * dpr) / 2);
    stamp.render(ctx, color ?? stamp.defaultColor);
  }, [stamp, color]);
  return <canvas ref={ref} />;
}

function normalizeDeg(rad: number): number {
  let d = Math.round(rad / DEG) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

interface Props {
  doc: PhotoDoc;
  apply: ApplyFn;
  selected: StampLayer | null;
  onSelect: (id: string | null) => void;
}

export function StampPanel({ doc, apply, selected, onSelect }: Props) {
  const add = (stampId: string) => {
    const layer = createStampLayer(doc, stampId);
    apply((d) => ({ ...d, layers: [...d.layers, layer] }));
    onSelect(layer.id);
  };

  if (selected) {
    const id = selected.id;
    const set = (patch: Partial<StampLayer>, key?: string) => apply((d) => updateLayer(d, id, patch), key);
    return (
      <div className="panel">
        <div className="button-row">
          <button className="tool-btn" onClick={() => onSelect(null)}>
            <Icon name="plus" />
            ほかのスタンプ
          </button>
          <button className="tool-btn" onClick={() => apply((d) => bringToFront(d, id))}>
            <Icon name="front" />
            手前へ
          </button>
          <button
            className="tool-btn danger"
            onClick={() => {
              apply((d) => removeLayer(d, id));
              onSelect(null);
            }}
          >
            <Icon name="trash" />
            削除
          </button>
        </div>
        <p className="section-label">色</p>
        <ColorRow
          label="スタンプの色"
          value={selected.color}
          colors={TEXT_COLORS.slice(1)}
          extra={[STAMPS.find((s) => s.id === selected.stampId)?.defaultColor ?? '#ff5a7a']}
          onChange={(color) => set({ color })}
        />
        <Slider
          label="大きさ"
          min={4}
          max={60}
          step={0.5}
          value={selected.size}
          defaultValue={14}
          format={(v) => v.toFixed(0)}
          onChange={(v, key) => set({ size: v }, key)}
        />
        <Slider
          label="回転"
          min={-180}
          max={180}
          step={1}
          value={normalizeDeg(selected.rotation)}
          defaultValue={0}
          format={(v) => `${v}°`}
          onChange={(v, key) => set({ rotation: v * DEG }, key)}
        />
      </div>
    );
  }

  return (
    <div className="panel">
      <p className="hint">タップすると写真の上に置けます。置いたスタンプは指で動かせます。</p>
      <div className="thumb-grid">
        {STAMPS.map((s) => (
          <button key={s.id} className="thumb-btn" onClick={() => add(s.id)} aria-label={`${s.label}を置く`}>
            <StampIcon stamp={s} />
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

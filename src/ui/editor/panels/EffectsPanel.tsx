import type { EffectSettings, PhotoDoc } from '../../../core/model/types';
import { LIGHT_LEAKS } from '../../../core/render/effects';
import { Slider } from '../../components/Slider';
import type { ApplyFn } from '../Stage';

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function EffectsPanel({ doc, apply }: { doc: PhotoDoc; apply: ApplyFn }) {
  const fx = doc.effects;
  const set = (patch: Partial<EffectSettings>, key?: string) =>
    apply((d) => ({ ...d, effects: { ...d.effects, ...patch } }), key);
  return (
    <div className="panel">
      <Slider label="粒子" min={0} max={1} step={0.05} value={fx.grain} defaultValue={0} format={pct} onChange={(v, k) => set({ grain: v }, k)} />
      <Slider
        label="周辺の暗さ"
        min={0}
        max={1}
        step={0.05}
        value={fx.vignette}
        defaultValue={0}
        format={pct}
        onChange={(v, k) => set({ vignette: v }, k)}
      />
      <p className="section-label">光漏れ</p>
      <div className="chips" role="radiogroup" aria-label="光漏れ">
        {LIGHT_LEAKS.map((l) => (
          <button
            key={l.id}
            role="radio"
            aria-checked={fx.lightLeak === l.id}
            className={`chip ${fx.lightLeak === l.id ? 'on' : ''}`}
            onClick={() => set({ lightLeak: l.id })}
          >
            {l.label}
          </button>
        ))}
      </div>
      {fx.lightLeak !== 'none' && (
        <Slider
          label="光の強さ"
          min={0.1}
          max={1}
          step={0.05}
          value={fx.lightLeakStrength}
          defaultValue={0.7}
          format={pct}
          onChange={(v, k) => set({ lightLeakStrength: v }, k)}
        />
      )}
    </div>
  );
}

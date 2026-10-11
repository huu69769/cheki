import { FRAME_SHAPES, marginCenter } from '../../../core/frames/shapes';
import { getFrameStyle } from '../../../core/frames/styles';
import { FONTS, fontFamilyCss } from '../../../core/fonts/fonts';
import { bringToFront, removeLayer, updateLayer } from '../../../core/model/doc';
import type { PhotoDoc, TextLayer, TextStyleKind } from '../../../core/model/types';
import { ColorRow } from '../../components/ColorRow';
import { Icon } from '../../components/Icon';
import { Slider } from '../../components/Slider';
import type { ApplyFn } from '../Stage';

const DEG = Math.PI / 180;

const STYLES: { id: TextStyleKind; label: string }[] = [
  { id: 'plain', label: 'ふつう' },
  { id: 'outline', label: 'ふちどり' },
  { id: 'shadow', label: 'かげ' },
];

function normalizeDeg(rad: number): number {
  let d = Math.round(rad / DEG) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

interface Props {
  doc: PhotoDoc;
  apply: ApplyFn;
  selected: TextLayer | null;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDeselect: () => void;
}

export function TextPanel({ doc, apply, selected, onAdd, onEdit, onDeselect }: Props) {
  const texts = doc.layers.filter((l) => l.kind === 'text');
  if (!selected) {
    return (
      <div className="panel">
        <button className="big-btn primary" onClick={onAdd}>
          <Icon name="plus" />
          文字を追加
        </button>
        <p className="hint">
          {texts.length > 0
            ? '入れた文字をタップすると、色や大きさを変えられます。もう一度タップすると文字を書き直せます。'
            : '文字は下の余白にも、写真の上にも置けます。指で動かしてください。'}
        </p>
      </div>
    );
  }

  const id = selected.id;
  const shape = FRAME_SHAPES[doc.frame.shapeId];
  const set = (patch: Partial<TextLayer>, key?: string) => apply((d) => updateLayer(d, id, patch), key);

  return (
    <div className="panel">
      <div className="button-row">
        <button className="tool-btn accent" onClick={() => onEdit(id)}>
          <Icon name="edit" />
          書き直す
        </button>
        <button
          className="tool-btn"
          onClick={() => {
            const p = marginCenter(shape);
            set({ x: p.x, y: p.y, rotation: 0 });
          }}
        >
          余白へ
        </button>
        <button
          className="tool-btn"
          onClick={() => set({ x: shape.window.x + shape.window.w / 2, y: shape.window.y + shape.window.h * 0.82 })}
        >
          写真の上へ
        </button>
        <button className="tool-btn" onClick={() => apply((d) => bringToFront(d, id))} aria-label="いちばん手前へ">
          <Icon name="front" />
          手前へ
        </button>
        <button
          className="tool-btn danger"
          onClick={() => {
            apply((d) => removeLayer(d, id));
            onDeselect();
          }}
        >
          <Icon name="trash" />
          削除
        </button>
        <button className="tool-btn" onClick={onAdd}>
          <Icon name="plus" />
          追加
        </button>
      </div>

      <p className="section-label">フォント</p>
      <div className="h-scroll">
        {FONTS.map((f) => (
          <button
            key={f.id}
            className={`chip font-chip ${selected.fontId === f.id ? 'on' : ''}`}
            style={{ fontFamily: fontFamilyCss(f), fontWeight: f.weight }}
            aria-pressed={selected.fontId === f.id}
            onClick={() => set({ fontId: f.id })}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="section-label">色</p>
      <ColorRow
        label="文字の色"
        value={selected.color}
        extra={[getFrameStyle(doc.frame.styleId).ink]}
        onChange={(color) => set({ color })}
      />

      <div className="chips" role="radiogroup" aria-label="文字の飾り">
        {STYLES.map((s) => (
          <button
            key={s.id}
            role="radio"
            aria-checked={selected.style === s.id}
            className={`chip ${selected.style === s.id ? 'on' : ''}`}
            onClick={() => set({ style: s.id })}
          >
            {s.label}
          </button>
        ))}
      </div>

      <Slider
        label="大きさ"
        min={2}
        max={30}
        step={0.1}
        value={selected.size}
        defaultValue={6}
        format={(v) => v.toFixed(1)}
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

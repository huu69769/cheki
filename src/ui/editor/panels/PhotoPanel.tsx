import type { PhotoDoc } from '../../../core/model/types';
import { Icon } from '../../components/Icon';
import { Slider } from '../../components/Slider';
import type { ApplyFn } from '../Stage';

const DEG = Math.PI / 180;

/** 角度を -180〜180 度の範囲に収める */
function normalize(rad: number): number {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

interface Props {
  doc: PhotoDoc;
  apply: ApplyFn;
  onChangePhoto: () => void;
}

export function PhotoPanel({ doc, apply, onChangePhoto }: Props) {
  const t = doc.photo;
  return (
    <div className="panel">
      <p className="hint">写真を指で動かせます。2本指で拡大・回転できます。</p>
      <Slider
        label="拡大"
        min={0.5}
        max={5}
        step={0.01}
        value={t.scale}
        defaultValue={1}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v, key) => apply((d) => ({ ...d, photo: { ...d.photo, scale: v } }), key)}
      />
      <Slider
        label="回転"
        min={-180}
        max={180}
        step={1}
        value={Math.round(normalize(t.rotation) / DEG)}
        defaultValue={0}
        format={(v) => `${v}°`}
        onChange={(v, key) => apply((d) => ({ ...d, photo: { ...d.photo, rotation: v * DEG } }), key)}
      />
      <div className="button-row">
        <button
          className="tool-btn"
          onClick={() => apply((d) => ({ ...d, photo: { ...d.photo, rotation: normalize(d.photo.rotation + Math.PI / 2) } }))}
        >
          <Icon name="rotate" />
          90°回転
        </button>
        <button className="tool-btn" onClick={() => apply((d) => ({ ...d, photo: { ...d.photo, flipX: !d.photo.flipX } }))}>
          <Icon name="flip" />
          左右反転
        </button>
        <button
          className="tool-btn"
          onClick={() => apply((d) => ({ ...d, photo: { x: 0, y: 0, scale: 1, rotation: 0, flipX: false } }))}
        >
          <Icon name="reset" />
          リセット
        </button>
        <button className="tool-btn" onClick={onChangePhoto}>
          <Icon name="image" />
          写真を変更
        </button>
      </div>
    </div>
  );
}

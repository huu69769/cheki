import { useRef } from 'react';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** 表示用の値の書き方 */
  format?: (v: number) => string;
  /** mergeKey は「1回のつまみ操作」ごとに変わる。元に戻すの単位に使う */
  onChange: (v: number, mergeKey: string) => void;
  /** ダブルタップで戻す値 */
  defaultValue?: number;
}

let counter = 0;

export function Slider({ label, value, min, max, step = 0.01, format, onChange, defaultValue }: Props) {
  const keyRef = useRef(`slider-${++counter}`);
  const lastTap = useRef(0);
  const newKey = () => {
    keyRef.current = `slider-${++counter}`;
  };
  return (
    <label className="slider">
      <span className="slider-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={() => {
          newKey();
          const now = Date.now();
          if (defaultValue !== undefined && now - lastTap.current < 300) {
            onChange(defaultValue, keyRef.current);
          }
          lastTap.current = now;
        }}
        onFocus={newKey}
        onChange={(e) => onChange(Number(e.currentTarget.value), keyRef.current)}
      />
      <span className="slider-value">{format ? format(value) : value.toFixed(2)}</span>
    </label>
  );
}

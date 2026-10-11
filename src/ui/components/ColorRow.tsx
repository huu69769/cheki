export const TEXT_COLORS = [
  '#2a2a2a',
  '#ffffff',
  '#e8473f',
  '#ff8a3d',
  '#f5c518',
  '#3fae6a',
  '#2f80ed',
  '#7b61ff',
  '#ff6fa5',
  '#8b5a2b',
  '#9aa0a6',
  '#0f3d5e',
];

interface Props {
  value: string;
  onChange: (color: string) => void;
  colors?: string[];
  /** 先頭に追加する色（フレームに合う色など） */
  extra?: string[];
  label: string;
}

function rgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}

/** ほとんど同じ色か */
function similar(a: string, b: string): boolean {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2) < 40;
}

export function ColorRow({ value, onChange, colors = TEXT_COLORS, extra = [], label }: Props) {
  const list = [...extra.filter((c) => !colors.some((x) => similar(x, c))), ...colors];
  // 選んでいる色が一覧にない場合（フレームを変えた後など）も、選択中として表示する
  if (!list.some((c) => c.toLowerCase() === value.toLowerCase())) list.unshift(value);
  return (
    <div className="color-row" role="radiogroup" aria-label={label}>
      {list.map((c) => (
        <button
          key={c}
          role="radio"
          aria-checked={value.toLowerCase() === c.toLowerCase()}
          aria-label={c}
          className={`color-dot ${value.toLowerCase() === c.toLowerCase() ? 'on' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}

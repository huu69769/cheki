import { DATE_STAMP_COLORS, todayString } from '../../../core/model/doc';
import type { DateFormatId, DatePosition, DateStampSettings, PhotoDoc } from '../../../core/model/types';
import { formatDateStamp } from '../../../core/render/dateStamp';
import type { ApplyFn } from '../Stage';

const FORMATS: DateFormatId[] = ['yy-mm-dd', 'yyyy-mm-dd', 'mm-dd-yy', 'dd-mm-yy'];
const POSITIONS: { id: DatePosition; label: string }[] = [
  { id: 'br', label: '右下' },
  { id: 'bl', label: '左下' },
  { id: 'tr', label: '右上' },
  { id: 'margin', label: '余白' },
];

export function DatePanel({ doc, apply }: { doc: PhotoDoc; apply: ApplyFn }) {
  const ds = doc.dateStamp;
  const set = (patch: Partial<DateStampSettings>) => apply((d) => ({ ...d, dateStamp: { ...d.dateStamp, ...patch } }));
  return (
    <div className="panel">
      <div className="switch-row">
        <span>日付を入れる</span>
        <button
          role="switch"
          aria-checked={ds.enabled}
          aria-label="日付を入れる"
          className={`switch ${ds.enabled ? 'on' : ''}`}
          onClick={() => set({ enabled: !ds.enabled })}
        />
      </div>
      {ds.enabled && (
        <>
          <div className="button-row">
            <input
              type="date"
              className="date-input"
              value={ds.date}
              aria-label="日付"
              onChange={(e) => {
                const v = e.currentTarget.value;
                if (/^\d{4}-\d{2}-\d{2}$/.test(v)) set({ date: v });
              }}
            />
            <button className="tool-btn" onClick={() => set({ date: todayString() })}>
              今日
            </button>
          </div>
          <p className="section-label">表示のしかた</p>
          <div className="chips" role="radiogroup" aria-label="日付の書き方">
            {FORMATS.map((f) => (
              <button
                key={f}
                role="radio"
                aria-checked={ds.format === f}
                className={`chip ${ds.format === f ? 'on' : ''}`}
                onClick={() => set({ format: f })}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatDateStamp(ds.date, f)}
              </button>
            ))}
          </div>
          <p className="section-label">位置</p>
          <div className="chips" role="radiogroup" aria-label="日付の位置">
            {POSITIONS.map((p) => (
              <button
                key={p.id}
                role="radio"
                aria-checked={ds.position === p.id}
                className={`chip ${ds.position === p.id ? 'on' : ''}`}
                onClick={() => set({ position: p.id })}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="section-label">色</p>
          <div className="chips" role="radiogroup" aria-label="日付の色">
            {DATE_STAMP_COLORS.map((c) => (
              <button
                key={c.id}
                role="radio"
                aria-checked={ds.color === c.color}
                className={`chip ${ds.color === c.color ? 'on' : ''}`}
                onClick={() => set({ color: c.color })}
              >
                <span className="color-mini" style={{ background: c.color }} />
                {c.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

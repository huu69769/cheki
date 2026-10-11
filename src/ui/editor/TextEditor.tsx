import { forwardRef, useEffect, useState } from 'react';
import { FONTS, fontFamilyCss, getFont } from '../../core/fonts/fonts';
import { ColorRow } from '../components/ColorRow';

export interface TextDraft {
  /** 編集中のレイヤー（新しく追加するときは null） */
  layerId: string | null;
  text: string;
  fontId: string;
  color: string;
}

interface Props {
  draft: TextDraft;
  /** 文字を見やすく表示するための背景色（フレームの色） */
  background: string;
  frameInk: string;
  onChange: (d: TextDraft) => void;
  onCancel: () => void;
  onDone: () => void;
}

/**
 * 文字の入力画面。キーボードで隠れないように、上側に入力欄を置く。
 * iOS でキーボードを出すため、開くボタンの処理の中で textarea にフォーカスする（ref を親に渡す）。
 */
export const TextEditor = forwardRef<HTMLTextAreaElement, Props>(function TextEditor(
  { draft, background, frameInk, onChange, onCancel, onDone },
  ref,
) {
  const font = getFont(draft.fontId);
  // キーボード表示中の見える高さ（iOS ではキーボードが画面に重なるため）
  const [viewH, setViewH] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setViewH(vv.height);
    update();
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, []);

  return (
    <div className="text-editor" style={viewH ? { height: viewH, bottom: 'auto' } : undefined}>
      <header className="topbar">
        <button className="text-btn" onClick={onCancel}>
          キャンセル
        </button>
        <h2>{draft.layerId ? '文字を編集' : '文字を追加'}</h2>
        <button className="text-btn primary-btn" onClick={onDone}>
          完了
        </button>
      </header>
      <div className="text-editor-body">
        <textarea
          ref={ref}
          value={draft.text}
          placeholder="ここに文字を入力"
          rows={2}
          style={{ fontFamily: fontFamilyCss(font), fontWeight: font.weight, color: draft.color, background }}
          onChange={(e) => onChange({ ...draft, text: e.currentTarget.value })}
        />
        <p className="section-label">フォント</p>
        <div className="h-scroll">
          {FONTS.map((f) => (
            <button
              key={f.id}
              className={`chip font-chip ${draft.fontId === f.id ? 'on' : ''}`}
              style={{ fontFamily: fontFamilyCss(f), fontWeight: f.weight }}
              aria-pressed={draft.fontId === f.id}
              onClick={() => onChange({ ...draft, fontId: f.id })}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="section-label">色</p>
        <ColorRow label="文字の色" value={draft.color} extra={[frameInk]} onChange={(color) => onChange({ ...draft, color })} />
      </div>
    </div>
  );
});

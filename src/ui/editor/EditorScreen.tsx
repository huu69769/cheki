import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { getFrameStyle } from '../../core/frames/styles';
import { DEFAULT_FONT_ID, ensureFontLoaded, getFont } from '../../core/fonts/fonts';
import { createTextLayer, removeLayer, updateLayer } from '../../core/model/doc';
import type { PhotoDoc, TextLayer } from '../../core/model/types';
import type { LoadedPhoto } from '../../core/render/photoSource';
import { Icon, type IconName } from '../components/Icon';
import { DatePanel } from './panels/DatePanel';
import { EffectsPanel } from './panels/EffectsPanel';
import { FilterPanel } from './panels/FilterPanel';
import { FramePanel } from './panels/FramePanel';
import { StampPanel } from './panels/StampPanel';
import { PhotoPanel } from './panels/PhotoPanel';
import { TextPanel } from './panels/TextPanel';
import { Stage, type ApplyFn } from './Stage';
import { TextEditor, type TextDraft } from './TextEditor';

type ToolId = 'frame' | 'photo' | 'text' | 'filter' | 'effects' | 'date' | 'stamp';

const TOOLS: { id: ToolId; label: string; icon: IconName }[] = [
  { id: 'frame', label: 'フレーム', icon: 'frame' },
  { id: 'photo', label: '写真', icon: 'move' },
  { id: 'text', label: '文字', icon: 'text' },
  { id: 'filter', label: 'フィルター', icon: 'filter' },
  { id: 'effects', label: '効果', icon: 'sparkle' },
  { id: 'date', label: '日付', icon: 'calendar' },
  { id: 'stamp', label: 'スタンプ', icon: 'sticker' },
];

interface Props {
  doc: PhotoDoc;
  photo: LoadedPhoto;
  apply: ApplyFn;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onHome: () => void;
  onChangePhoto: () => void;
  onExport: () => void;
}

export function EditorScreen(props: Props) {
  const { doc, photo, apply, undo, redo, canUndo, canRedo, onHome, onChangePhoto, onExport } = props;
  const [tool, setTool] = useState<ToolId>('frame');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null);
  const [lastFontId, setLastFontId] = useState(DEFAULT_FONT_ID);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedLayer = doc.layers.find((l) => l.id === selectedId) ?? null;
  const frameStyle = getFrameStyle(doc.frame.styleId);

  // ---- フォントの読み込み（使っている文字の分だけ）。読み込めたら描き直す ----
  const [fontsVersion, setFontsVersion] = useState(0);
  const textsKey = doc.layers
    .filter((l): l is TextLayer => l.kind === 'text')
    .map((l) => `${l.fontId}\u0000${l.text}`)
    .join('\u0001');
  useEffect(() => {
    let alive = true;
    const jobs = doc.layers
      .filter((l): l is TextLayer => l.kind === 'text')
      .map((l) => ensureFontLoaded(getFont(l.fontId), l.text));
    if (jobs.length === 0) return;
    Promise.all(jobs).then(() => {
      if (alive) setFontsVersion((v) => v + 1);
    });
    return () => {
      alive = false;
    };
  }, [textsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 選択 ----
  const select = (id: string | null) => {
    setSelectedId(id);
    const layer = doc.layers.find((l) => l.id === id);
    if (layer) setTool(layer.kind === 'text' ? 'text' : 'stamp');
  };

  // ---- 文字の入力 ----
  const openTextEditor = (layerId: string | null) => {
    const layer = layerId ? doc.layers.find((l): l is TextLayer => l.id === layerId && l.kind === 'text') : undefined;
    const draft: TextDraft = layer
      ? { layerId: layer.id, text: layer.text, fontId: layer.fontId, color: layer.color }
      : { layerId: null, text: '', fontId: lastFontId, color: frameStyle.ink };
    // iOS でキーボードを出すには、タップの処理の中でフォーカスする必要があるので、すぐに描画してからフォーカスする
    flushSync(() => setTextDraft(draft));
    textareaRef.current?.focus();
  };

  const finishTextEditor = () => {
    const d = textDraft;
    setTextDraft(null);
    if (!d) return;
    const text = d.text.replace(/\s+$/u, '');
    setLastFontId(d.fontId);
    if (d.layerId) {
      const id = d.layerId;
      if (!text.trim()) {
        apply((doc0) => removeLayer(doc0, id));
        setSelectedId(null);
      } else {
        apply((doc0) => updateLayer(doc0, id, { text, fontId: d.fontId, color: d.color }));
      }
    } else if (text.trim()) {
      const layer = createTextLayer(doc, text, { fontId: d.fontId, color: d.color });
      apply((doc0) => ({ ...doc0, layers: [...doc0.layers, layer] }));
      setSelectedId(layer.id);
      setTool('text');
    }
  };

  return (
    <div className="screen editor">
      <header className="topbar">
        <button className="icon-btn" aria-label="ホームへ" onClick={onHome}>
          <Icon name="home" />
        </button>
        <div className="topbar-center">
          <button className="icon-btn" aria-label="元に戻す" disabled={!canUndo} onClick={undo}>
            <Icon name="undo" />
          </button>
          <button className="icon-btn" aria-label="やり直し" disabled={!canRedo} onClick={redo}>
            <Icon name="redo" />
          </button>
        </div>
        <button
          className="primary-btn"
          onClick={() => {
            setSelectedId(null);
            onExport();
          }}
        >
          書き出す
        </button>
      </header>

      <Stage
        doc={doc}
        photo={photo}
        selectedId={selectedLayer ? selectedLayer.id : null}
        onSelect={select}
        apply={apply}
        onTapSelectedText={openTextEditor}
        fontsVersion={fontsVersion}
      />

      <div className="bottom">
        <div className="panel-area">
          {tool === 'frame' && <FramePanel doc={doc} apply={apply} />}
          {tool === 'photo' && <PhotoPanel doc={doc} apply={apply} onChangePhoto={onChangePhoto} />}
          {tool === 'filter' && <FilterPanel doc={doc} apply={apply} photo={photo} />}
          {tool === 'effects' && <EffectsPanel doc={doc} apply={apply} />}
          {tool === 'date' && <DatePanel doc={doc} apply={apply} />}
          {tool === 'stamp' && (
            <StampPanel
              doc={doc}
              apply={apply}
              selected={selectedLayer?.kind === 'stamp' ? selectedLayer : null}
              onSelect={setSelectedId}
            />
          )}
          {tool === 'text' && (
            <TextPanel
              doc={doc}
              apply={apply}
              selected={selectedLayer?.kind === 'text' ? selectedLayer : null}
              onAdd={() => openTextEditor(null)}
              onEdit={openTextEditor}
              onDeselect={() => setSelectedId(null)}
            />
          )}
        </div>
        <nav className="tabbar" aria-label="編集メニュー">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`tab ${tool === t.id ? 'on' : ''}`}
              aria-pressed={tool === t.id}
              onClick={() => {
                setTool(t.id);
                const keep = selectedLayer && (selectedLayer.kind === 'text' ? t.id === 'text' : t.id === 'stamp');
                if (selectedLayer && !keep) setSelectedId(null);
              }}
            >
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {textDraft && (
        <TextEditor
          ref={textareaRef}
          draft={textDraft}
          background={frameStyle.base}
          frameInk={frameStyle.ink}
          onChange={setTextDraft}
          onCancel={() => setTextDraft(null)}
          onDone={finishTextEditor}
        />
      )}
    </div>
  );
}

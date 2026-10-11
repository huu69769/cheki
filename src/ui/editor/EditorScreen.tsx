import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { getFrameStyle } from '../../core/frames/styles';
import { DEFAULT_FONT_ID, ensureFontLoaded, getFont } from '../../core/fonts/fonts';
import { createTextLayer, removeLayer, updateLayer } from '../../core/model/doc';
import type { PhotoDoc, TextLayer } from '../../core/model/types';
import type { LoadedPhoto } from '../../core/render/photoSource';
import type { VideoPlayer } from '../../core/video/videoPlayer';
import { Icon, type IconName } from '../components/Icon';
import { DatePanel } from './panels/DatePanel';
import { EffectsPanel } from './panels/EffectsPanel';
import { FilterPanel } from './panels/FilterPanel';
import { FramePanel } from './panels/FramePanel';
import { StampPanel } from './panels/StampPanel';
import { PhotoPanel } from './panels/PhotoPanel';
import { TextPanel } from './panels/TextPanel';
import { ThumbPanel, TrimPanel, VideoControls, VideoModePanel } from './panels/VideoPanels';
import { Stage, type ApplyFn } from './Stage';
import { usePhotoStageSource, useVideoStageSource } from './stageSources';
import { TextEditor, type TextDraft } from './TextEditor';

type ToolId = 'video' | 'trim' | 'thumb' | 'frame' | 'photo' | 'text' | 'filter' | 'effects' | 'date' | 'stamp';

const COMMON_TOOLS: { id: ToolId; label: string; icon: IconName }[] = [
  { id: 'frame', label: 'フレーム', icon: 'frame' },
  { id: 'photo', label: '写真', icon: 'move' },
  { id: 'text', label: '文字', icon: 'text' },
  { id: 'filter', label: 'フィルター', icon: 'filter' },
  { id: 'effects', label: '効果', icon: 'sparkle' },
  { id: 'date', label: '日付', icon: 'calendar' },
  { id: 'stamp', label: 'スタンプ', icon: 'sticker' },
];

/** 編集するもの：写真、または動画 */
export type EditorMedia = { kind: 'photo'; photo: LoadedPhoto } | { kind: 'video'; player: VideoPlayer };

interface Props {
  doc: PhotoDoc;
  media: EditorMedia;
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
  const { doc, media, apply, undo, redo, canUndo, canRedo, onHome, onChangePhoto, onExport } = props;
  const isVideo = media.kind === 'video';
  const photo = media.kind === 'photo' ? media.photo : null;
  const player = media.kind === 'video' ? media.player : null;
  const [tool, setTool] = useState<ToolId>(isVideo ? 'video' : 'frame');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null);
  const [lastFontId, setLastFontId] = useState(DEFAULT_FONT_ID);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedLayer = doc.layers.find((l) => l.id === selectedId) ?? null;
  const frameStyle = getFrameStyle(doc.frame.styleId);

  // ---- 動画の再生（プレビュー） ----
  const [frame, setFrame] = useState<HTMLCanvasElement | null>(player?.frame ?? null);
  const [frameVersion, setFrameVersion] = useState(0);
  const [currentTime, setCurrentTime] = useState(player?.time ?? 0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    if (!player) return;
    player.setCallbacks({
      onFrame: (f, t) => {
        setFrame(f);
        setCurrentTime(t);
        setFrameVersion((n) => n + 1);
      },
      onPlayingChange: setPlaying,
    });
    if (!player.frame) void player.seek(doc.video?.trimStart ?? 0);
    return () => {
      player.pause();
      player.setCallbacks({ onFrame: () => {}, onPlayingChange: () => {} });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);
  const trimStart = doc.video?.trimStart ?? 0;
  const trimEnd = doc.video?.trimEnd ?? 0;
  useEffect(() => {
    player?.setRange(trimStart, trimEnd);
  }, [player, trimStart, trimEnd]);
  const seek = (t: number) => {
    if (!player) return;
    setCurrentTime(t);
    void player.seek(t);
  };

  const videoSize = useMemo(
    () => (player ? { width: player.media.info.width, height: player.media.info.height } : null),
    [player],
  );
  const photoSource = usePhotoStageSource(photo);
  const videoSource = useVideoStageSource(frame, frameVersion, videoSize);
  const stageSource = (isVideo ? videoSource : photoSource)!;

  const tools = useMemo(() => {
    if (!isVideo) return COMMON_TOOLS;
    const videoTools: { id: ToolId; label: string; icon: IconName }[] = [
      { id: 'video', label: '動画', icon: 'video' },
      { id: 'trim', label: '長さ', icon: 'trim' },
    ];
    if (doc.video?.mode === 'B') videoTools.push({ id: 'thumb', label: 'サムネ', icon: 'image' });
    return [...videoTools, ...COMMON_TOOLS.map((t) => (t.id === 'photo' ? { ...t, label: '位置' } : t))];
  }, [isVideo, doc.video?.mode]);
  // サムネのタブが消えたとき（入り込まない方に変えたとき）は「動画」タブに戻す
  useEffect(() => {
    if (!tools.some((t) => t.id === tool)) setTool(tools[0].id);
  }, [tools, tool]);

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
            player?.pause();
            onExport();
          }}
        >
          書き出す
        </button>
      </header>

      <Stage
        doc={doc}
        source={stageSource}
        selectedId={selectedLayer ? selectedLayer.id : null}
        onSelect={select}
        apply={apply}
        onTapSelectedText={openTextEditor}
        fontsVersion={fontsVersion}
      />

      {player && (
        <VideoControls
          doc={doc}
          playing={playing}
          currentTime={currentTime}
          muted={muted}
          onTogglePlay={() => (playing ? player.pause() : player.play())}
          onSeek={seek}
          onToggleMute={() => {
            player.setMuted(!muted);
            setMuted(!muted);
          }}
        />
      )}

      <div className="bottom">
        <div className="panel-area">
          {tool === 'video' && <VideoModePanel doc={doc} apply={apply} />}
          {tool === 'trim' && player && (
            <TrimPanel doc={doc} apply={apply} duration={player.media.info.duration} currentTime={currentTime} onSeek={seek} />
          )}
          {tool === 'thumb' && <ThumbPanel doc={doc} apply={apply} currentTime={currentTime} onSeek={seek} />}
          {tool === 'frame' && <FramePanel doc={doc} apply={apply} />}
          {tool === 'photo' && (
            <PhotoPanel doc={doc} apply={apply} onChangePhoto={isVideo ? undefined : onChangePhoto} noun={isVideo ? '動画' : '写真'} />
          )}
          {tool === 'filter' && <FilterPanel doc={doc} apply={apply} sample={photo ? photo.canvas : frame} />}
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
          {tools.map((t) => (
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

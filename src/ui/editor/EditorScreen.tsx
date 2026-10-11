import { useState } from 'react';
import type { PhotoDoc } from '../../core/model/types';
import type { LoadedPhoto } from '../../core/render/photoSource';
import { Icon, type IconName } from '../components/Icon';
import { FramePanel } from './panels/FramePanel';
import { PhotoPanel } from './panels/PhotoPanel';
import { Stage, type ApplyFn } from './Stage';

type ToolId = 'frame' | 'photo';

const TOOLS: { id: ToolId; label: string; icon: IconName }[] = [
  { id: 'frame', label: 'フレーム', icon: 'frame' },
  { id: 'photo', label: '写真', icon: 'move' },
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
}

export function EditorScreen(props: Props) {
  const { doc, photo, apply, undo, redo, canUndo, canRedo, onHome, onChangePhoto } = props;
  const [tool, setTool] = useState<ToolId>('frame');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fontsVersion = 0;

  const selectedLayer = doc.layers.find((l) => l.id === selectedId) ?? null;

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
        <span className="topbar-spacer" />
      </header>

      <Stage
        doc={doc}
        photo={photo}
        selectedId={selectedLayer ? selectedLayer.id : null}
        onSelect={setSelectedId}
        apply={apply}
        onTapSelectedText={() => {}}
        fontsVersion={fontsVersion}
      />

      <div className="bottom">
        <div className="panel-area">
          {tool === 'frame' && <FramePanel doc={doc} apply={apply} />}
          {tool === 'photo' && <PhotoPanel doc={doc} apply={apply} onChangePhoto={onChangePhoto} />}
        </div>
        <nav className="tabbar" aria-label="編集メニュー">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`tab ${tool === t.id ? 'on' : ''}`}
              aria-pressed={tool === t.id}
              onClick={() => setTool(t.id)}
            >
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

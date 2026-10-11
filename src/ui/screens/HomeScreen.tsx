import { useEffect, useState } from 'react';
import { APP_NAME } from '../../config';
import { Icon } from '../components/Icon';

export interface DraftSummary {
  updatedAt: number;
  thumbUrl: string;
}

interface Props {
  draft: DraftSummary | null;
  onPick: (source: 'camera' | 'library') => void;
  onResume: () => void;
  onDeleteDraft: () => void;
  onShowAbout: () => void;
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function HomeScreen({ draft, onPick, onResume, onDeleteDraft, onShowAbout }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => setConfirmDelete(false), [draft]);

  return (
    <div className="screen home">
      <div className="home-hero">
        <div className="hero-films" aria-hidden="true">
          <div className="hero-film f1">
            <div className="hero-window" />
          </div>
          <div className="hero-film f2">
            <div className="hero-window" />
          </div>
        </div>
        <h1 className="home-title">{APP_NAME}</h1>
        <p className="home-sub">インスタントカメラ風の写真をつくろう</p>
      </div>

      <div className="home-actions">
        <button className="big-btn primary" onClick={() => onPick('library')}>
          <Icon name="image" size={26} />
          写真を選ぶ
        </button>
        <button className="big-btn" onClick={() => onPick('camera')}>
          <Icon name="camera" size={26} />
          カメラで撮る
        </button>

        {draft && (
          <div className="draft-card">
            <button className="draft-main" onClick={onResume}>
              <img src={draft.thumbUrl} alt="" className="draft-thumb" />
              <span className="draft-text">
                <strong>続きから編集</strong>
                <small>{formatTime(draft.updatedAt)} の下書き</small>
              </span>
            </button>
            {confirmDelete ? (
              <button className="draft-delete confirm" onClick={onDeleteDraft}>
                削除する
              </button>
            ) : (
              <button className="draft-delete" aria-label="下書きを削除" onClick={() => setConfirmDelete(true)}>
                <Icon name="trash" />
              </button>
            )}
          </div>
        )}
      </div>

      <footer className="home-footer">
        <p>写真はこの端末の中だけで加工します。外部に送信されることはありません。</p>
        <button className="link-btn" onClick={onShowAbout}>
          このアプリについて・ライセンス
        </button>
      </footer>
    </div>
  );
}

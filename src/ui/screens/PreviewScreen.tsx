import { useEffect, useMemo, useState } from 'react';
import { APP_NAME } from '../../config';
import { platform, type OutputFile } from '../../platform';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';

export interface ExportedMedia {
  file: OutputFile;
  width: number;
  height: number;
}

interface Props {
  media: ExportedMedia;
  /** 書き出したデータを捨てて、編集画面に戻る */
  onBackToEdit: () => void;
}

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * 書き出した結果の確認画面。ここで「保存」「共有」「編集に戻る」を選ぶ。
 * （書き出し直後にいきなり保存・共有はしない）
 */
export function PreviewScreen({ media, onBackToEdit }: Props) {
  const toast = useToast();
  const { file } = media;
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file.blob]);
  const isVideo = file.mimeType.startsWith('video/');
  const canShare = useMemo(() => platform.output.canShare(file), [file]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const r = await platform.output.save(file);
      if (r.kind === 'saved-to-gallery') toast('写真アプリに保存しました');
      else if (r.kind === 'downloaded') toast('保存しました（ダウンロード）');
    } catch {
      toast('保存できませんでした');
    } finally {
      setSaving(false);
    }
  };

  const share = () => {
    // Web Share API はボタンを押した直後に呼ぶ必要があるので、await の前に呼び出す
    platform.output
      .share(file, { title: APP_NAME })
      .then((r) => {
        if (r.kind === 'shared') toast('共有しました');
      })
      .catch(() => toast('共有できませんでした。「保存」をお使いください'));
  };

  return (
    <div className="screen preview">
      <header className="topbar">
        <button className="icon-btn" aria-label="編集に戻る" onClick={onBackToEdit}>
          <Icon name="back" />
        </button>
        <h2 className="topbar-title">仕上がりの確認</h2>
        <span className="icon-btn" aria-hidden="true" />
      </header>
      <div className="preview-media">
        {url && (isVideo ? <video src={url} controls playsInline autoPlay loop /> : <img src={url} alt="書き出した画像" />)}
      </div>
      <p className="preview-info">
        {media.width} × {media.height} px ・ {formatBytes(file.blob.size)} ・ {file.mimeType === 'image/png' ? 'PNG' : file.mimeType === 'image/jpeg' ? 'JPEG' : 'MP4'}
      </p>
      <div className="preview-actions">
        <button className="big-btn primary" onClick={save} disabled={saving}>
          <Icon name="download" />
          保存
        </button>
        <button className="big-btn" onClick={share} disabled={!canShare}>
          <Icon name="share" />
          共有
        </button>
        <button className="big-btn wide" onClick={onBackToEdit}>
          <Icon name="edit" />
          編集に戻る
        </button>
        <p className="preview-note">
          {platform.output.saveDescription(file)}
          {!canShare && ' この端末のブラウザは共有に対応していません。'}
        </p>
      </div>
    </div>
  );
}

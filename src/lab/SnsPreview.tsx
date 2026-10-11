import { useEffect, useState } from 'react';
import { Icon } from '../ui/components/Icon';

interface Props {
  blob: Blob;
  width: number;
  height: number;
  label: string;
  onClose: () => void;
}

/**
 * 書き出した動画を SNS に投稿したときの見え方の目安（検証ページ専用）。
 * 各サービスの画面を簡単な図で再現しているだけで、実際の表示とは多少違うことがある。
 */
export function SnsPreview({ blob, width, height, label, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  const aspect = width / height;
  // フィードは、縦長は 4:5 まで、横長は 1.91:1 までしか表示されず、はみ出た分は切り取られる
  const feedAspect = Math.min(1.91, Math.max(0.8, aspect));
  const feedCropped = Math.abs(feedAspect - aspect) > 0.01;
  const shortsBars = aspect > 9 / 16 + 0.01;

  const vid = (fit: 'contain' | 'cover') =>
    url && <video src={url} muted loop autoPlay playsInline style={{ objectFit: fit }} className="sns-video" />;

  return (
    <div className="sns-overlay" role="dialog" aria-modal="true" aria-label="SNSでの見え方">
      <header className="topbar">
        <button className="icon-btn" aria-label="閉じる" onClick={onClose}>
          <Icon name="back" />
        </button>
        <h2 className="topbar-title">SNSでの見え方（目安）</h2>
        <span className="icon-btn" aria-hidden="true" />
      </header>
      <div className="sns-body">
        <p className="hint">
          {label}（{width}×{height}）。各サービスの画面を簡単に再現した目安です。実際の表示はアプリの更新などで変わることがあります。
        </p>

        <section className="sns-case">
          <h3>縦長のショート動画の画面</h3>
          <p className="hint">TikTok・Instagram のリール・YouTube ショートなど。画面いっぱい（9:16）で再生されます。</p>
          <div className="mock-phone">
            <div className="mock-shorts">
              {vid('contain')}
              <div className="mock-shorts-ui" aria-hidden="true">
                <div className="mock-side">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="mock-caption">
                  <span style={{ width: '45%' }} />
                  <span style={{ width: '70%' }} />
                </div>
              </div>
            </div>
          </div>
          <p className="sns-note">
            {shortsBars ? '9:16 より横長なので、上下に黒い帯が付きます。' : '画面いっぱいに表示されます。'}
            右側のボタンと下の説明文が重なる部分（灰色）は、文字などが隠れやすい場所です。
          </p>
        </section>

        <section className="sns-case">
          <h3>Instagram のフィード（タイムライン）</h3>
          <p className="hint">投稿がタイムラインに流れてくるときの表示です。</p>
          <div className="mock-phone mock-feed">
            <div className="mock-feed-head" aria-hidden="true">
              <span className="mock-avatar" />
              <span className="mock-line" style={{ width: '35%' }} />
            </div>
            <div className="mock-feed-media" style={{ aspectRatio: String(feedAspect) }}>
              {vid('cover')}
            </div>
            <div className="mock-feed-actions" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="mock-caption mock-feed-caption" aria-hidden="true">
              <span style={{ width: '60%' }} />
              <span style={{ width: '40%' }} />
            </div>
          </div>
          <p className="sns-note">
            {feedCropped
              ? aspect < 0.8
                ? '4:5 より縦長なので、上下が切り取られて表示されます（タップして開くと全体が見られることがあります）。'
                : '横長すぎるので、左右が切り取られて表示されます。'
              : '切り取られずに、そのままの形で表示されます。'}
          </p>
        </section>

        <section className="sns-case">
          <h3>LINE などのトークで送ったとき</h3>
          <p className="hint">動画はそのままの形で表示されます。</p>
          <div className="mock-phone mock-chat">
            <div className="mock-bubble-left" aria-hidden="true">
              <span className="mock-line" style={{ width: '70%' }} />
            </div>
            <div className="mock-chat-media" style={{ aspectRatio: String(aspect) }}>
              {vid('contain')}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

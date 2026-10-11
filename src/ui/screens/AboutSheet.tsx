import { APP_NAME } from '../../config';
import { FONTS } from '../../core/fonts/fonts';
import { Icon } from '../components/Icon';

const OFL = 'SIL Open Font License 1.1';
const FONT_LICENSES: Record<string, { author: string; license: string }> = {
  Yomogi: { author: 'Copyright 2020 The Yomogi Project Authors', license: OFL },
  'Klee One': { author: 'Copyright 2020 The Klee Project Authors', license: OFL },
  'Zen Kurenaido': { author: 'Copyright 2021 The Zen Kurenaido Project Authors', license: OFL },
  'Hachi Maru Pop': { author: 'Copyright 2020 The Hachi Maru Pop Project Authors', license: OFL },
  'Zen Maru Gothic': { author: 'Copyright 2021 The Zen Maru Gothic Authors', license: OFL },
  DotGothic16: { author: 'Copyright 2020 The DotGothic16 Project Authors', license: OFL },
  Caveat: { author: 'Copyright 2014 The Caveat Project Authors', license: OFL },
  Pacifico: { author: 'Copyright 2018 The Pacifico Project Authors', license: OFL },
  'Permanent Marker': { author: 'Copyright (c) 2010 by Font Diner, Inc.', license: 'Apache License 2.0' },
};

export function AboutSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet about" role="dialog" aria-modal="true" aria-label="このアプリについて" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>このアプリについて</h2>
          <button className="icon-btn" aria-label="閉じる" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet-body">
          <p>
            {APP_NAME}
            は、写真をインスタントカメラ風に加工するアプリです。写真の読み込みから書き出しまで、すべてこの端末の中で処理します。写真が外部のサーバーに送られることはありません。
          </p>
          <h3>フォント</h3>
          <ul className="license-list">
            {FONTS.filter((f) => f.family).map((f) => (
              <li key={f.id}>
                <strong>{f.family}</strong>
                <span>
                  {FONT_LICENSES[f.family]?.author} / {FONT_LICENSES[f.family]?.license}
                </span>
              </li>
            ))}
          </ul>
          <h3>そのほかの素材</h3>
          <p>フレームの柄、スタンプ、日付の数字、粒子・光漏れなどの効果は、すべてこのアプリのために作ったオリジナルです。</p>
          <h3>ソフトウェア</h3>
          <p>React（MIT License）、@fontsource（フォントの配布パッケージ）を使っています。</p>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { exportSize, type PhotoExportOptions, type PhotoFormat, type PhotoQuality } from '../../core/export/exportPhoto';
import type { PhotoDoc } from '../../core/model/types';
import { Icon } from '../components/Icon';

interface Props {
  doc: PhotoDoc;
  initial: PhotoExportOptions;
  onCancel: () => void;
  onExport: (opts: PhotoExportOptions) => void;
}

export function ExportSheet({ doc, initial, onCancel, onExport }: Props) {
  const [format, setFormat] = useState<PhotoFormat>(initial.format);
  const [quality, setQuality] = useState<PhotoQuality>(initial.quality);
  const size = exportSize(doc, quality);
  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="書き出し" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>画像として書き出す</h2>
          <button className="icon-btn" aria-label="閉じる" onClick={onCancel}>
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet-body">
          <div className="option-group">
            <p className="section-label">形式</p>
            <div className="segmented" role="radiogroup" aria-label="形式">
              <button role="radio" aria-checked={format === 'jpeg'} className={format === 'jpeg' ? 'on' : ''} onClick={() => setFormat('jpeg')}>
                JPEG（軽い）
              </button>
              <button role="radio" aria-checked={format === 'png'} className={format === 'png' ? 'on' : ''} onClick={() => setFormat('png')}>
                PNG（劣化なし）
              </button>
            </div>
          </div>
          <div className="option-group">
            <p className="section-label">大きさ</p>
            <div className="segmented" role="radiogroup" aria-label="大きさ">
              <button role="radio" aria-checked={quality === 'standard'} className={quality === 'standard' ? 'on' : ''} onClick={() => setQuality('standard')}>
                標準
              </button>
              <button role="radio" aria-checked={quality === 'high'} className={quality === 'high' ? 'on' : ''} onClick={() => setQuality('high')}>
                高画質
              </button>
            </div>
            <p className="hint">
              {size.width} × {size.height} px
            </p>
          </div>
          <button className="big-btn primary" onClick={() => onExport({ format, quality })}>
            <Icon name="check" />
            書き出す
          </button>
        </div>
      </div>
    </div>
  );
}

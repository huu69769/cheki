import { MAX_VIDEO_SECONDS, VIDEO_THUMB_SECONDS } from '../../../config';
import type { PhotoDoc, VideoAspect, VideoSettings } from '../../../core/model/types';
import { aspectLabel, clampTrim, effectiveThumbTime, VIDEO_ASPECTS_A, VIDEO_ASPECTS_B } from '../../../core/video/videoLayout';
import { Icon } from '../../components/Icon';
import type { ApplyFn } from '../Stage';

export function formatTime(t: number): string {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

function setVideo(apply: ApplyFn, patch: Partial<VideoSettings>, key?: string) {
  apply((d) => (d.video ? { ...d, video: { ...d.video, ...patch } } : d), key);
}

/** 「動画」タブ：モード（入り込む・入り込まない）と、書き出す動画の形 */
export function VideoModePanel({ doc, apply }: { doc: PhotoDoc; apply: ApplyFn }) {
  const v = doc.video;
  if (!v) return null;
  const aspects: VideoAspect[] = v.mode === 'A' ? VIDEO_ASPECTS_A : VIDEO_ASPECTS_B;
  const current = v.mode === 'A' ? v.aspectA : v.aspectB;
  return (
    <div className="panel">
      <div className="segmented" role="radiogroup" aria-label="モード">
        <button role="radio" aria-checked={v.mode === 'A'} className={v.mode === 'A' ? 'on' : ''} onClick={() => setVideo(apply, { mode: 'A' })}>
          入り込まない
        </button>
        <button role="radio" aria-checked={v.mode === 'B'} className={v.mode === 'B' ? 'on' : ''} onClick={() => setVideo(apply, { mode: 'B' })}>
          入り込む
        </button>
      </div>
      <p className="hint">
        {v.mode === 'A'
          ? 'フレームの中で動画が再生されます。'
          : `サムネの写真を${VIDEO_THUMB_SECONDS}秒見せてから、写真の中へ入り込み、動画が画面いっぱいに再生されます。`}
      </p>
      <p className="section-label">書き出す動画の形</p>
      <div className="chips" role="radiogroup" aria-label="書き出す動画の形">
        {aspects.map((a) => (
          <button
            key={a}
            role="radio"
            aria-checked={current === a}
            className={`chip ${current === a ? 'on' : ''}`}
            onClick={() =>
              setVideo(apply, v.mode === 'A' ? { aspectA: a } : { aspectB: a as Exclude<VideoAspect, 'film'> })
            }
          >
            {aspectLabel(a)}
          </button>
        ))}
      </div>
      <p className="hint">
        {current === 'film'
          ? 'フィルムのフチがそのまま動画の端になります（背景なし）。'
          : 'フレームのまわりはパステルの背景になります。'}
      </p>
    </div>
  );
}

interface TimeProps {
  doc: PhotoDoc;
  apply: ApplyFn;
  duration: number;
  currentTime: number;
  onSeek: (t: number) => void;
}

/** 「長さ」タブ：使う範囲（始まりと終わり）を選ぶ */
export function TrimPanel({ doc, apply, duration, currentTime, onSeek }: TimeProps) {
  const v = doc.video;
  if (!v) return null;
  const setTrim = (start: number, end: number, changed: 'start' | 'end', key?: string) => {
    const r = clampTrim(start, end, duration, changed);
    setVideo(apply, r, key);
    onSeek(changed === 'start' ? r.trimStart : Math.max(r.trimStart, r.trimEnd - 0.05));
  };
  const len = v.trimEnd - v.trimStart;
  return (
    <div className="panel">
      <p className="hint">
        使う長さ：<strong>{len.toFixed(1)}秒</strong>（元の動画 {duration.toFixed(1)}秒・最長 {MAX_VIDEO_SECONDS}秒）
      </p>
      <label className="slider">
        <span className="slider-label">始まり</span>
        <input
          type="range"
          min={0}
          max={duration}
          step={0.05}
          value={v.trimStart}
          onChange={(e) => setTrim(Number(e.currentTarget.value), v.trimEnd, 'start', 'trim-start')}
        />
        <span className="slider-value">{formatTime(v.trimStart)}</span>
      </label>
      <label className="slider">
        <span className="slider-label">終わり</span>
        <input
          type="range"
          min={0}
          max={duration}
          step={0.05}
          value={v.trimEnd}
          onChange={(e) => setTrim(v.trimStart, Number(e.currentTarget.value), 'end', 'trim-end')}
        />
        <span className="slider-value">{formatTime(v.trimEnd)}</span>
      </label>
      <div className="button-row">
        <button className="tool-btn" onClick={() => setTrim(currentTime, v.trimEnd, 'start')}>
          いまの場面を始まりに
        </button>
        <button className="tool-btn" onClick={() => setTrim(v.trimStart, currentTime, 'end')}>
          いまの場面を終わりに
        </button>
        <button className="tool-btn" onClick={() => setTrim(0, Math.min(duration, MAX_VIDEO_SECONDS), 'end')}>
          <Icon name="reset" />
          元に戻す
        </button>
      </div>
    </div>
  );
}

/** 「サムネ」タブ：入り込む前に写真として見せる場面を選ぶ */
export function ThumbPanel({ doc, apply, currentTime, onSeek }: Omit<TimeProps, 'duration'>) {
  const v = doc.video;
  if (!v) return null;
  const thumb = effectiveThumbTime(v);
  return (
    <div className="panel">
      <p className="hint">
        再生バーで好きな場面まで動かして、「この場面をサムネにする」を押してください。最初は動画の始まりの場面です。
      </p>
      <div className="button-row">
        <button className="tool-btn accent" onClick={() => setVideo(apply, { thumbTime: currentTime })}>
          この場面をサムネにする
        </button>
        <button className="tool-btn" onClick={() => onSeek(thumb)}>
          サムネの場面へ
        </button>
        {v.thumbTime !== null && (
          <button className="tool-btn" onClick={() => setVideo(apply, { thumbTime: null })}>
            <Icon name="reset" />
            始まりの場面に戻す
          </button>
        )}
      </div>
      <p className="hint">いまのサムネ：{formatTime(thumb - v.trimStart)}（再生バーの上のオレンジの印）</p>
    </div>
  );
}

interface ControlsProps {
  doc: PhotoDoc;
  playing: boolean;
  currentTime: number;
  muted: boolean;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onToggleMute: () => void;
}

/** 編集画面の再生バー（再生・一時停止、シークバー、編集中だけ音を止めるボタン） */
export function VideoControls({ doc, playing, currentTime, muted, onTogglePlay, onSeek, onToggleMute }: ControlsProps) {
  const v = doc.video;
  if (!v) return null;
  const len = Math.max(0.01, v.trimEnd - v.trimStart);
  const rel = Math.min(len, Math.max(0, currentTime - v.trimStart));
  const thumbRel = effectiveThumbTime(v) - v.trimStart;
  return (
    <div className="video-controls">
      <button className="icon-btn" aria-label={playing ? '一時停止' : '再生'} onClick={onTogglePlay}>
        <Icon name={playing ? 'pause' : 'play'} />
      </button>
      <div className="seek-bar">
        <input
          type="range"
          min={0}
          max={len}
          step={0.01}
          value={rel}
          aria-label="再生位置"
          onChange={(e) => onSeek(v.trimStart + Number(e.currentTarget.value))}
        />
        {v.mode === 'B' && <span className="seek-marker" style={{ left: `${(thumbRel / len) * 100}%` }} title="サムネの場面" />}
      </div>
      <span className="seek-time">
        {formatTime(rel)} / {formatTime(len)}
      </span>
      <button
        className={`icon-btn ${muted ? 'muted' : ''}`}
        aria-label={muted ? '音を出す（編集中のみ）' : '音を止める（編集中のみ）'}
        aria-pressed={muted}
        onClick={onToggleMute}
      >
        <Icon name={muted ? 'mute' : 'volume'} />
      </button>
    </div>
  );
}

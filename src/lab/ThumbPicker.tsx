import { useCallback, useEffect, useRef, useState } from 'react';
import { FRAME_SHAPES } from '../core/frames/shapes';
import type { FrameShapeId, PhotoDoc } from '../core/model/types';
import { renderDocument } from '../core/render/renderer';
import { Icon } from '../ui/components/Icon';
import { makeTestDoc } from './videoExportTest';

interface Props {
  file: Blob;
  shapeId: FrameShapeId;
  /** サムネに選んだ場面（秒） */
  value: number;
  onChange: (time: number) => void;
}

const PREVIEW_CSS_W = 220;

function fmt(t: number) {
  if (!Number.isFinite(t)) return '0:00.0';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

/**
 * サムネ（再生前にフィルムに写っている1コマ）を選ぶ。
 * 動画をフィルムの中で再生し、シークバーで好きな場面まで動かして「この場面をサムネにする」で決める。
 */
export function ThumbPicker({ file, shapeId, value, onChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [doc, setDoc] = useState<PhotoDoc | null>(null);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(value);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useEffect(() => {
    let alive = true;
    makeTestDoc(shapeId).then((d) => alive && setDoc(d));
    return () => {
      alive = false;
    };
  }, [shapeId]);

  /** いまの場面を、フィルムに入れた見た目で描く */
  const draw = useCallback(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !doc || v.readyState < 2 || !v.videoWidth) return;
    const shape = FRAME_SHAPES[shapeId];
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(PREVIEW_CSS_W * dpr);
    const h = Math.round((w * shape.height) / shape.width);
    if (c.width !== w) c.width = w;
    if (c.height !== h) c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    renderDocument(ctx, doc, { image: v, width: v.videoWidth, height: v.videoHeight }, { pxPerMm: w / shape.width, cacheFrame: true });
  }, [doc, shapeId]);

  useEffect(() => {
    draw();
  }, [draw]);

  // 再生中は毎コマ描き直す
  useEffect(() => {
    if (!playing) return;
    let id = 0;
    const loop = () => {
      draw();
      const v = videoRef.current;
      if (v) setCurrent(v.currentTime);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [playing, draw]);

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = t;
    setCurrent(t);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.ended || v.currentTime >= duration - 0.05) v.currentTime = 0;
      void v.play();
    } else {
      v.pause();
    }
  };

  const markerLeft = duration > 0 ? `${(Math.min(value, duration) / duration) * 100}%` : '0%';

  return (
    <div className="thumb-picker">
      {url && (
        <video
          ref={videoRef}
          src={url}
          className="thumb-video-source"
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            setDuration(v.duration);
            // 最初は、いま選んでいるサムネの場面を表示する
            v.currentTime = Math.min(value, Math.max(0, v.duration - 0.05));
          }}
          onLoadedData={draw}
          onSeeked={(e) => {
            setCurrent(e.currentTarget.currentTime);
            draw();
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => {
            setPlaying(false);
            draw();
          }}
          onEnded={() => setPlaying(false)}
        />
      )}
      <canvas ref={canvasRef} className="thumb-preview" style={{ width: PREVIEW_CSS_W }} />
      <div className="seek-row">
        <button className="icon-btn seek-play" aria-label={playing ? '一時停止' : '再生'} onClick={togglePlay}>
          <Icon name={playing ? 'pause' : 'play'} />
        </button>
        <div className="seek-bar">
          <input
            type="range"
            min={0}
            max={duration || 0.1}
            step={0.01}
            value={Math.min(current, duration || 0.1)}
            aria-label="再生位置"
            onChange={(e) => seek(Number(e.currentTarget.value))}
          />
          {duration > 0 && <span className="seek-marker" style={{ left: markerLeft }} title="サムネの場面" />}
        </div>
        <span className="seek-time">
          {fmt(current)} / {fmt(duration)}
        </span>
      </div>
      <div className="button-row">
        <button className="tool-btn accent" onClick={() => onChange(videoRef.current?.currentTime ?? current)}>
          この場面をサムネにする
        </button>
        <button className="tool-btn" onClick={() => seek(value)}>
          サムネの場面へ
        </button>
      </div>
      <p className="hint">いまのサムネ：{fmt(value)}（シークバーの上のオレンジの印）。プレビューは音が出ません。</p>
    </div>
  );
}

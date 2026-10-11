import { ALL_FORMATS, BlobSource, CanvasSink, Input } from 'mediabunny';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FRAME_SHAPES } from '../core/frames/shapes';
import type { FrameShapeId, PhotoDoc } from '../core/model/types';
import { renderDocument } from '../core/render/renderer';
import { createCanvas, get2d } from '../core/util/canvas';
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
/** コマを取り出すときの幅（px）。プレビュー用なので小さめ */
const GRAB_W = 480;

function fmt(t: number) {
  if (!Number.isFinite(t)) return '0:00.0';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * サムネ（再生前にフィルムに写っている1コマ）を選ぶ。
 * <video> は使わず、書き出しと同じ方法（Mediabunny）で動画からコマを直接取り出して表示する。
 * そのため、表示している絵・シークバーの位置・サムネになる場面が必ず一致する。
 */
export function ThumbPicker({ file, shapeId, value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PhotoDoc | null>(null);
  const [sink, setSink] = useState<CanvasSink | null>(null);
  const [duration, setDuration] = useState(0);
  /** シークバーの位置 */
  const [barTime, setBarTime] = useState(value);
  /** いま表示しているコマの時刻 */
  const [shownTime, setShownTime] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const lastFrame = useRef<HTMLCanvasElement | null>(null);
  const playToken = useRef(0);
  const seekState = useRef<{ pending: number | null; busy: boolean }>({ pending: null, busy: false });

  // 動画を開く（フィルムの窓と同じ縦横比でコマを取り出す）
  useEffect(() => {
    const win = FRAME_SHAPES[shapeId].window;
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    let alive = true;
    (async () => {
      const track = await input.getPrimaryVideoTrack();
      if (!track || !alive) return;
      const d = await input.computeDuration();
      if (!alive) return;
      setDuration(d);
      setSink(new CanvasSink(track, { width: GRAB_W, height: Math.round((GRAB_W * win.h) / win.w), fit: 'cover' }));
    })().catch(() => {});
    return () => {
      alive = false;
      playToken.current++;
      setSink(null);
      input.dispose();
    };
  }, [file, shapeId]);

  useEffect(() => {
    let alive = true;
    makeTestDoc(shapeId).then((d) => alive && setDoc(d));
    return () => {
      alive = false;
    };
  }, [shapeId]);

  /** コマをフィルムに入れた見た目で描く */
  const draw = useCallback(
    (frame: HTMLCanvasElement) => {
      const c = canvasRef.current;
      if (!c || !doc) return;
      const shape = FRAME_SHAPES[shapeId];
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const w = Math.round(PREVIEW_CSS_W * dpr);
      const h = Math.round((w * shape.height) / shape.width);
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      renderDocument(ctx, doc, { image: frame, width: frame.width, height: frame.height }, { pxPerMm: w / shape.width, cacheFrame: true });
    },
    [doc, shapeId],
  );

  const keep = (src: HTMLCanvasElement) => {
    // 取り出したコマは使い回されることがあるので、最後に表示したものはコピーして持っておく
    let c = lastFrame.current;
    if (!c || c.width !== src.width || c.height !== src.height) c = createCanvas(src.width, src.height);
    get2d(c).drawImage(src, 0, 0);
    lastFrame.current = c;
    return c;
  };

  /** 指定した時刻のコマを表示する。続けて呼ばれたら、最後の時刻だけを表示する */
  const showAt = useCallback(
    async (t: number) => {
      if (!sink) return;
      const st = seekState.current;
      st.pending = t;
      if (st.busy) return;
      st.busy = true;
      try {
        while (st.pending !== null) {
          const target = st.pending;
          st.pending = null;
          const wc = await sink.getCanvas(target);
          if (wc && st.pending === null) {
            draw(keep(wc.canvas as HTMLCanvasElement));
            setShownTime(wc.timestamp);
          }
        }
      } catch {
        // 取り出せなかったコマは表示しない
      } finally {
        st.busy = false;
      }
    },
    [sink, draw],
  );

  // 開いたとき・フレームの形が変わったときは、いまのサムネの場面を表示する
  useEffect(() => {
    if (sink && doc) void showAt(Math.min(value, Math.max(0, duration - 0.05)));
  }, [sink, doc]);

  const stop = () => {
    playToken.current++;
    setPlaying(false);
  };

  const play = async () => {
    if (!sink) return;
    const token = ++playToken.current;
    setPlaying(true);
    const start = barTime >= duration - 0.1 ? 0 : barTime;
    const wallStart = performance.now();
    try {
      for await (const wc of sink.canvases(start)) {
        if (token !== playToken.current) return;
        // そのコマの時刻になるまで待つ（実際の速さで再生する）
        const wait = (wc.timestamp - start) * 1000 - (performance.now() - wallStart);
        if (wait > 0) await sleep(wait);
        if (token !== playToken.current) return;
        draw(keep(wc.canvas as HTMLCanvasElement));
        setShownTime(wc.timestamp);
        setBarTime(wc.timestamp);
      }
    } catch {
      // 途中で止めた場合など
    }
    if (token === playToken.current) setPlaying(false);
  };

  const onSeek = (t: number) => {
    if (playing) stop();
    setBarTime(t);
    void showAt(t);
  };

  const max = duration > 0 ? Math.max(0, duration - 0.02) : 0.1;
  const markerLeft = duration > 0 ? `${(Math.min(value, duration) / duration) * 100}%` : '0%';
  const settled = shownTime !== null && !playing && Math.abs(shownTime - barTime) < 0.1;

  return (
    <div className="thumb-picker">
      <canvas ref={canvasRef} className="thumb-preview" style={{ width: PREVIEW_CSS_W }} />
      <div className="seek-row">
        <button
          className="icon-btn seek-play"
          aria-label={playing ? '一時停止' : '再生'}
          disabled={!sink}
          onClick={() => (playing ? stop() : void play())}
        >
          <Icon name={playing ? 'pause' : 'play'} />
        </button>
        <div className="seek-bar">
          <input
            type="range"
            min={0}
            max={max}
            step={0.01}
            value={Math.min(barTime, max)}
            aria-label="再生位置"
            disabled={!sink}
            onChange={(e) => onSeek(Number(e.currentTarget.value))}
          />
          {duration > 0 && <span className="seek-marker" style={{ left: markerLeft }} title="サムネの場面" />}
        </div>
        <span className="seek-time">
          {fmt(barTime)} / {fmt(duration)}
        </span>
      </div>
      <div className="button-row">
        <button
          className="tool-btn accent"
          disabled={shownTime === null}
          onClick={() => {
            if (playing) stop();
            // 画面に出ているコマを、そのままサムネにする
            if (shownTime !== null) {
              onChange(shownTime);
              setBarTime(shownTime);
            }
          }}
        >
          この場面をサムネにする
        </button>
        <button className="tool-btn" disabled={!sink} onClick={() => onSeek(value)}>
          サムネの場面へ
        </button>
      </div>
      <p className="hint">
        いまのサムネ：{fmt(value)}（シークバーの上のオレンジの印）
        {!settled && shownTime !== null && !playing ? '・表示を更新しています…' : ''}。プレビューは音が出ません。
      </p>
    </div>
  );
}

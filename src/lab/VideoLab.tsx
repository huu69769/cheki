import { canDecodeVideo, canEncodeAudio, canEncodeVideo } from 'mediabunny';
import { useEffect, useRef, useState } from 'react';
import { MAX_VIDEO_SECONDS } from '../config';
import type { FrameShapeId } from '../core/model/types';
import { platform, type PickedFile } from '../platform';
import { Icon } from '../ui/components/Icon';
import { useToast } from '../ui/components/Toast';
import { PreviewScreen, type ExportedMedia } from '../ui/screens/PreviewScreen';
import { SnsPreview } from './SnsPreview';
import { ThumbPicker } from './ThumbPicker';
import {
  CancelledError,
  probeVideo,
  runExportTest,
  type Aspect,
  type Background,
  type ExportTestResult,
  type InputInfo,
  type Mode,
} from './videoExportTest';

type Env = Record<string, string>;

async function checkEnv(): Promise<Env> {
  const yes = (b: boolean) => (b ? '○' : '×');
  const env: Env = {};
  env['ブラウザ'] = navigator.userAgent;
  env['VideoEncoder'] = yes(typeof VideoEncoder !== 'undefined');
  env['VideoDecoder'] = yes(typeof VideoDecoder !== 'undefined');
  env['AudioEncoder'] = yes(typeof AudioEncoder !== 'undefined');
  env['AudioDecoder'] = yes(typeof AudioDecoder !== 'undefined');
  const safe = async (f: () => Promise<boolean>) => {
    try {
      return yes(await f());
    } catch {
      return '×（エラー）';
    }
  };
  env['H.264書き出し 1080×1920'] = await safe(() => canEncodeVideo('avc', { width: 1080, height: 1920 }));
  env['H.264書き出し 1080×1080'] = await safe(() => canEncodeVideo('avc', { width: 1080, height: 1080 }));
  env['AAC書き出し（再エンコード）'] = await safe(() => canEncodeAudio('aac'));
  env['HEVC読み込み'] = await safe(() => canDecodeVideo('hevc'));
  env['H.264読み込み'] = await safe(() => canDecodeVideo('avc'));
  const mr = typeof MediaRecorder !== 'undefined';
  env['MediaRecorder'] = yes(mr);
  if (mr) {
    for (const t of ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus']) {
      env[`MediaRecorder ${t}`] = yes(MediaRecorder.isTypeSupported(t));
    }
  }
  env['canvas.captureStream'] = yes(typeof HTMLCanvasElement.prototype.captureStream === 'function');
  env['isSecureContext'] = yes(window.isSecureContext);
  env['CPUコア数'] = String(navigator.hardwareConcurrency ?? '不明');
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  env['メモリ（目安）'] = mem ? `${mem} GB` : '不明';
  return env;
}

function fmtSec(ms: number) {
  return `${(ms / 1000).toFixed(1)} 秒`;
}

/**
 * フェーズ2の技術検証ページ（?lab=video で開く）。
 * スマホで実際に動画を書き出して、対応状況と処理時間を測る。
 */
export function VideoLab() {
  const toast = useToast();
  const [env, setEnv] = useState<Env | null>(null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [info, setInfo] = useState<InputInfo | null>(null);
  const [aspect, setAspect] = useState<Aspect>('film');
  const [mode, setMode] = useState<Mode>('A');
  const [shapeId, setShapeId] = useState<FrameShapeId>('mini');
  const [background, setBackground] = useState<Background>('blur');
  const [cpuFilter, setCpuFilter] = useState(false);
  const [short, setShort] = useState(false);
  const [thumbTime, setThumbTime] = useState(0.5);
  const [sns, setSns] = useState<(ExportTestResult & { label: string }) | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; stage: string; startedAt: number } | null>(null);
  const [results, setResults] = useState<(ExportTestResult & { label: string; id: number })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ExportedMedia | null>(null);
  const signal = useRef({ cancelled: false });
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    checkEnv().then(setEnv);
  }, []);

  const pick = () => {
    platform.media.pickVideo('library').then(async (f) => {
      if (!f) return;
      setFile(f);
      setInfo(null);
      setResults([]);
      setThumbTime(0.5);
      setError(null);
      try {
        setInfo(await probeVideo(f.blob));
      } catch (e) {
        setError(`動画を調べられませんでした：${e instanceof Error ? e.message : String(e)}`);
      }
    });
  };

  const run = async () => {
    if (!file) return;
    signal.current = { cancelled: false };
    setError(null);
    const startedAt = performance.now();
    setProgress({ done: 0, total: 1, stage: '準備', startedAt });
    const shapeLabel = shapeId === 'mini' ? 'ミニ' : shapeId === 'square' ? 'スクエア' : 'ワイド';
    const label = [
      mode === 'A' ? 'A：フレームの中で再生' : 'B：写真から入り込む',
      aspect === 'film' ? 'フィルムの形そのまま' : aspect,
      shapeLabel,
      aspect === 'film' ? null : background === 'blur' ? '背景ぼかし' : '背景パステル',
      cpuFilter ? 'CPUフィルター' : null,
      short ? '5秒' : null,
    ]
      .filter(Boolean)
      .join(' / ');
    try {
      const r = await runExportTest(file.blob, {
        aspect,
        mode,
        shapeId,
        background,
        thumbTime,
        cpuFilter,
        fps: 30,
        maxSeconds: short ? 5 : MAX_VIDEO_SECONDS,
        signal: signal.current,
        onProgress: (p) => setProgress({ ...p, startedAt }),
      });
      setResults((list) => [{ ...r, label, id: Date.now() }, ...list]);
      setLog((l) => [
        ...l,
        `${label}：${fmtSec(r.elapsedMs)}（動画 ${r.outputSeconds.toFixed(1)} 秒、${r.frames}コマ、${(r.frames / (r.elapsedMs / 1000)).toFixed(1)} コマ/秒、${(r.blob.size / 1024 / 1024).toFixed(1)} MB、映像：${r.videoCodec}、音声：${r.audio}）`,
      ]);
    } catch (e) {
      if (e instanceof CancelledError) setError('キャンセルしました');
      else setError(`失敗：${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
      setLog((l) => [...l, `${label}：失敗（${e instanceof Error ? e.message : String(e)}）`]);
    } finally {
      setProgress(null);
    }
  };

  const report = () => {
    const lines = [
      '【動画書き出しテストの結果】',
      ...(env ? Object.entries(env).map(([k, v]) => `${k}: ${v}`) : []),
      '',
      info
        ? `入力：${info.mimeType}、${info.width}×${info.height}、回転${info.rotation}°、${info.durationSec.toFixed(1)}秒、映像 ${info.videoCodec}（読み込み${info.canDecodeVideo ? '○' : '×'}）、音声 ${info.audioCodec ?? 'なし'}`
        : '入力：未選択',
      ...log,
    ];
    return lines.join('\n');
  };

  const copyReport = async () => {
    const text = report();
    try {
      await navigator.clipboard.writeText(text);
      toast('結果をコピーしました。そのまま貼り付けて送ってください');
    } catch {
      window.prompt('この文章をコピーしてください', text);
    }
  };

  const pct = progress ? Math.min(100, Math.round((progress.done / Math.max(1, progress.total)) * 100)) : 0;

  return (
    <div className="screen lab">
      <header className="topbar">
        <a className="icon-btn" href="./" aria-label="アプリに戻る">
          <Icon name="back" />
        </a>
        <h2 className="topbar-title">動画書き出しテスト（開発用）</h2>
        <span className="icon-btn" aria-hidden="true" />
      </header>
      <div className="lab-body">
        <p className="hint">
          フェーズ2（動画）の技術検証用ページです。30秒くらいの動画を選んで「書き出してみる」を押し、かかった時間を確認してください。動画は端末の外には送信されません。
        </p>

        <section>
          <h3>1. この端末の対応状況</h3>
          {env ? (
            <table className="lab-table">
              <tbody>
                {Object.entries(env).map(([k, v]) => (
                  <tr key={k}>
                    <th>{k}</th>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="hint">調べています…</p>
          )}
        </section>

        <section>
          <h3>2. 動画を選ぶ</h3>
          <button className="big-btn" onClick={pick} disabled={!!progress}>
            <Icon name="video" />
            {file ? '別の動画を選ぶ' : '動画を選ぶ'}
          </button>
          {info && (
            <p className="hint">
              {info.width}×{info.height}（回転 {info.rotation}°）・{info.durationSec.toFixed(1)} 秒・映像 {info.videoCodec}
              {info.canDecodeVideo ? '' : '（この端末では読み込めません）'}・音声 {info.audioCodec ?? 'なし'}
              {info.durationSec > MAX_VIDEO_SECONDS && `。${MAX_VIDEO_SECONDS}秒を超える部分は使いません`}
            </p>
          )}
        </section>

        <section>
          <h3>3. 書き出してみる</h3>
          <div className="segmented" role="radiogroup" aria-label="モード">
            <button
              role="radio"
              aria-checked={mode === 'A'}
              className={mode === 'A' ? 'on' : ''}
              onClick={() => setMode('A')}
            >
              A：フレームの中で再生
            </button>
            <button
              role="radio"
              aria-checked={mode === 'B'}
              className={mode === 'B' ? 'on' : ''}
              onClick={() => {
                setMode('B');
                if (aspect === 'film') setAspect('9:16');
              }}
            >
              B：写真から入り込む
            </button>
          </div>
          {mode === 'B' && file && (
            <>
              <p className="section-label">サムネ（入り込む前に、写真としてフィルムに入る1コマ）</p>
              <ThumbPicker file={file.blob} shapeId={shapeId} value={thumbTime} onChange={setThumbTime} />
            </>
          )}
          <p className="section-label">動画の形</p>
          <div className="chips">
            {(['film', '9:16', '1:1', '4:5'] as Aspect[])
              .filter((a) => mode === 'A' || a !== 'film')
              .map((a) => (
                <button key={a} className={`chip ${aspect === a ? 'on' : ''}`} aria-pressed={aspect === a} onClick={() => setAspect(a)}>
                  {a === 'film' ? 'フィルムの形そのまま' : a}
                </button>
              ))}
          </div>
          <p className="section-label">フレームの形</p>
          <div className="chips">
            {(['mini', 'square', 'wide'] as FrameShapeId[]).map((s) => (
              <button key={s} className={`chip ${shapeId === s ? 'on' : ''}`} aria-pressed={shapeId === s} onClick={() => setShapeId(s)}>
                {s === 'mini' ? 'ミニ' : s === 'square' ? 'スクエア' : 'ワイド'}
              </button>
            ))}
          </div>
          {aspect !== 'film' && (
            <>
              <p className="section-label">フレームのまわりの背景{mode === 'B' ? '（入り込む前の約2秒だけ見えます）' : ''}</p>
              <div className="chips">
                <button className={`chip ${background === 'blur' ? 'on' : ''}`} aria-pressed={background === 'blur'} onClick={() => setBackground('blur')}>
                  動画をぼかしたもの
                </button>
                <button
                  className={`chip ${background === 'gradient' ? 'on' : ''}`}
                  aria-pressed={background === 'gradient'}
                  onClick={() => setBackground('gradient')}
                >
                  パステル
                </button>
              </div>
            </>
          )}
          <p className="section-label">そのほか</p>
          <div className="chips">
            <button className={`chip ${short ? 'on' : ''}`} aria-pressed={short} onClick={() => setShort(!short)}>
              最初の5秒だけ（見比べ用）
            </button>
            <button className={`chip ${cpuFilter ? 'on' : ''}`} aria-pressed={cpuFilter} onClick={() => setCpuFilter(!cpuFilter)}>
              フィルターあり（重さ確認）
            </button>
          </div>
          {progress ? (
            <div className="lab-progress">
              <div className="progress-bar">
                <div style={{ width: `${pct}%` }} />
              </div>
              <p className="hint">
                {progress.stage}：{pct}%（{progress.done}/{progress.total}コマ・{fmtSec(performance.now() - progress.startedAt)}）
              </p>
              <button className="big-btn" onClick={() => (signal.current.cancelled = true)}>
                キャンセル
              </button>
            </div>
          ) : (
            <button className="big-btn primary" onClick={run} disabled={!file}>
              書き出してみる
            </button>
          )}
          {error && <p className="lab-error">{error}</p>}
          {results.map((result) => (
            <div className="lab-result" key={result.id}>
              <p className="lab-result-label">{result.label}</p>
              <p>
                <strong>{fmtSec(result.elapsedMs)}</strong> で完了（動画 {result.outputSeconds.toFixed(1)} 秒・{result.frames}コマ・
                {(result.frames / (result.elapsedMs / 1000)).toFixed(1)} コマ/秒・{(result.blob.size / 1024 / 1024).toFixed(1)} MB・
                {result.width}×{result.height}）
              </p>
              <p>
                映像：{result.videoCodec}・音声：{result.audio}
              </p>
              <div className="button-row">
                <button className="tool-btn accent" onClick={() => setSns(result)}>
                  SNSでの見え方
                </button>
                <button
                  className="tool-btn"
                  onClick={() =>
                    setPreview({
                      file: { blob: result.blob, filename: `test-${result.id}.mp4`, mimeType: 'video/mp4' },
                      width: result.width,
                      height: result.height,
                    })
                  }
                >
                  再生して確認・保存
                </button>
              </div>
            </div>
          ))}
        </section>

        <section>
          <h3>4. 結果を送る</h3>
          {log.length > 0 && (
            <ul className="lab-log">
              {log.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
          <button className="big-btn" onClick={copyReport}>
            結果をコピー
          </button>
        </section>
      </div>
      {preview && <PreviewScreen media={preview} onBackToEdit={() => setPreview(null)} />}
      {sns && <SnsPreview blob={sns.blob} width={sns.width} height={sns.height} label={sns.label} onClose={() => setSns(null)} />}
    </div>
  );
}

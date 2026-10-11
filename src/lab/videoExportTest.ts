/**
 * フェーズ2の技術検証用：動画をインスタントカメラ風フレームに合成して MP4（H.264 + AAC）に書き出す試作。
 * WebCodecs + Mediabunny を使う。本番の実装ではなく、端末ごとの「動くか・どれくらい速いか」を測るためのもの。
 */
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  getFirstEncodableVideoCodec,
  type EncodedPacket,
} from 'mediabunny';
import { FRAME_SHAPES } from '../core/frames/shapes';
import { ensureFontLoaded, getFont } from '../core/fonts/fonts';
import { createDoc, createTextLayer } from '../core/model/doc';
import type { FrameShapeId, PhotoDoc } from '../core/model/types';
import { filterCanvasInPlace } from '../core/render/photoSource';
import { renderDocument } from '../core/render/renderer';
import { createCanvas, get2d } from '../core/util/canvas';

/** 'film' は、フィルムの形そのまま（余白・背景なし）の動画 */
export type Aspect = 'film' | '9:16' | '1:1' | '4:5';
export type Mode = 'A' | 'B';
export type Background = 'gradient' | 'blur';

export const ASPECT_SIZES: Record<Exclude<Aspect, 'film'>, { w: number; h: number }> = {
  '9:16': { w: 1080, h: 1920 },
  '1:1': { w: 1080, h: 1080 },
  '4:5': { w: 1080, h: 1350 },
};

/** 書き出す動画の大きさ（H.264 のため偶数にそろえる） */
export function outputSize(aspect: Aspect, shapeId: FrameShapeId): { w: number; h: number } {
  if (aspect !== 'film') return ASPECT_SIZES[aspect];
  const s = FRAME_SHAPES[shapeId];
  // 横長（ワイド）は高さを1080に、それ以外は幅を1080にする
  if (s.width > s.height) return { w: Math.round((1080 * s.width) / s.height / 2) * 2, h: 1080 };
  return { w: 1080, h: Math.round((1080 * s.height) / s.width / 2) * 2 };
}

export interface InputInfo {
  mimeType: string;
  durationSec: number;
  videoCodec: string | null;
  width: number;
  height: number;
  rotation: number;
  canDecodeVideo: boolean;
  audioCodec: string | null;
  canDecodeAudio: boolean;
}

export async function probeVideo(file: Blob): Promise<InputInfo> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const v = await input.getPrimaryVideoTrack();
    const a = await input.getPrimaryAudioTrack();
    return {
      mimeType: await input.getMimeType().catch(() => '不明'),
      durationSec: await input.computeDuration(),
      videoCodec: v ? await v.getCodecParameterString() : null,
      width: v ? await v.getSquarePixelWidth() : 0,
      height: v ? await v.getSquarePixelHeight() : 0,
      rotation: v ? await v.getRotation() : 0,
      canDecodeVideo: v ? await v.canDecode() : false,
      audioCodec: a ? await a.getCodecParameterString() : null,
      canDecodeAudio: a ? await a.canDecode() : false,
    };
  } finally {
    input.dispose();
  }
}

export interface ExportTestOptions {
  aspect: Aspect;
  mode: Mode;
  shapeId: FrameShapeId;
  background: Background;
  /** 入り込む前に写真として見せる1コマの時刻（秒） */
  thumbTime: number;
  maxSeconds: number;
  /** 1コマずつ CPU でフィルターをかける（重さの確認用） */
  cpuFilter: boolean;
  fps: number;
  onProgress: (p: { done: number; total: number; stage: string }) => void;
  signal: { cancelled: boolean };
}

export interface ExportTestResult {
  blob: Blob;
  width: number;
  height: number;
  outputSeconds: number;
  frames: number;
  elapsedMs: number;
  audio: 'コピー（再エンコードなし）' | 'なし（元の動画に音声なし）' | 'なし（AAC以外のため未対応）';
  videoCodec: string;
}

const INTRO_STILL = 0.6;
const INTRO_ZOOM = 1.2;
const INTRO_TOTAL = INTRO_STILL + INTRO_ZOOM;
/** 入り込まない方（モードA）で、再生前にサムネを止めて見せる長さ（秒） */
const STILL_A = 1.0;

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** 検証用のフレームの編集内容（固定） */
export async function makeTestDoc(shapeId: FrameShapeId): Promise<PhotoDoc> {
  const doc: PhotoDoc = createDoc();
  doc.frame = { shapeId, styleId: 'cream' };
  doc.effects = { ...doc.effects, grain: 0.35, vignette: 0.35 };
  doc.dateStamp = { ...doc.dateStamp, enabled: true };
  doc.layers = [createTextLayer(doc, '動画テスト', { fontId: 'yomogi' })];
  await ensureFontLoaded(getFont('yomogi'), '動画テスト');
  return doc;
}

export class CancelledError extends Error {
  constructor() {
    super('キャンセルしました');
  }
}

export async function runExportTest(file: Blob, opts: ExportTestOptions): Promise<ExportTestResult> {
  const t0 = performance.now();
  const { w: W, h: H } = outputSize(opts.aspect, opts.shapeId);
  const shape = FRAME_SHAPES[opts.shapeId];
  const win = shape.window;

  // フレームの編集内容（テスト用の固定値）
  const doc = await makeTestDoc(opts.shapeId);

  // 画面の中のフレームの置き方（フレーム全体が収まる大きさ）
  // （フィルムの形そのままのときは、余白なしで画面いっぱい）
  const fitPx = opts.aspect === 'film' ? W / shape.width : Math.min((W * 0.86) / shape.width, (H * 0.8) / shape.height);
  const fitOrigin = { x: (W - shape.width * fitPx) / 2, y: (H - shape.height * fitPx) / 2 };
  // 窓が画面いっぱいになる大きさ（モードBの最後）
  const zoomPx = Math.max(W / win.w, H / win.h);
  const zoomOrigin = { x: W / 2 - (win.x + win.w / 2) * zoomPx, y: H / 2 - (win.y + win.h / 2) * zoomPx };

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  try {
    const vTrack = await input.getPrimaryVideoTrack();
    if (!vTrack) throw new Error('動画のトラックが見つかりません');
    if (!(await vTrack.canDecode())) throw new Error(`この端末では、この動画（${await vTrack.getCodecParameterString()}）を読み込めません`);
    const aTrack = await input.getPrimaryAudioTrack();
    const srcDuration = await input.computeDuration();
    const mainDuration = Math.min(srcDuration, opts.maxSeconds);
    const offset = opts.mode === 'B' ? INTRO_TOTAL : STILL_A;
    const total = mainDuration + offset;

    const canvas = createCanvas(W, H);
    const ctx = get2d(canvas, { willReadFrequently: opts.cpuFilter });
    // 本番は H.264（avc）を使う。H.264 が使えない環境でも流れを確かめられるよう、検証では VP9 も候補にする
    const codec = await getFirstEncodableVideoCodec(['avc', 'vp9'], { width: W, height: H });
    if (!codec) throw new Error('この端末では動画を書き出せません（H.264/VP9 のエンコーダーがありません）');
    const videoSource = new CanvasSource(canvas, { codec, quality: new Quality('high'), keyFrameInterval: 2 });
    output.addVideoTrack(videoSource, { frameRate: opts.fps });

    let audioMode: ExportTestResult['audio'] = 'なし（元の動画に音声なし）';
    let audioSource: EncodedAudioPacketSource | null = null;
    let audioPackets: AsyncGenerator<EncodedPacket> | null = null;
    let audioMetaSent = false;
    let pendingAudio: EncodedPacket | null = null;
    let audioDone = false;
    const audioConfig = aTrack ? await aTrack.getDecoderConfig() : null;
    if (aTrack) {
      if ((await aTrack.getCodec()) === 'aac' && audioConfig) {
        audioSource = new EncodedAudioPacketSource('aac');
        output.addAudioTrack(audioSource);
        audioPackets = new EncodedPacketSink(aTrack).packets();
        audioMode = 'コピー（再エンコードなし）';
      } else {
        audioMode = 'なし（AAC以外のため未対応）';
      }
    }
    await output.start();

    /** 音声を、動画の時刻 upTo（秒）まで追加する（元の音声をそのままコピーし、時刻だけずらす） */
    const pumpAudio = async (upTo: number) => {
      if (!audioSource || !audioPackets || audioDone) return;
      for (;;) {
        if (!pendingAudio) {
          const r = await audioPackets.next();
          if (r.done) {
            audioDone = true;
            return;
          }
          pendingAudio = r.value;
        }
        const p = pendingAudio;
        if (p.timestamp >= mainDuration) {
          audioDone = true;
          return;
        }
        const t = p.timestamp + offset;
        if (t > upTo) return;
        pendingAudio = null;
        if (p.timestamp < 0) continue;
        const moved = p.clone({ timestamp: t });
        if (!audioMetaSent) {
          await audioSource.add(moved, { decoderConfig: audioConfig! });
          audioMetaSent = true;
        } else {
          await audioSource.add(moved);
        }
      }
    };

    const frameDur = 1 / opts.fps;
    const totalFrames = Math.ceil(total * opts.fps);
    let frames = 0;
    const check = () => {
      if (opts.signal.cancelled) throw new CancelledError();
    };

    const winPx = (k: number) => ({ w: Math.round(win.w * k), h: Math.round(win.h * k) });

    // 背景：パステルのグラデーション、または動画のコマを大きくぼかしたもの
    const tiny = createCanvas(Math.max(8, Math.round(W / 40)), Math.max(8, Math.round(H / 40)));
    const mid = createCanvas(Math.round(W / 8), Math.round(H / 8));
    const drawBackground = (src: CanvasImageSource, sw: number, sh: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (opts.background === 'blur') {
        // 小さく縮めてから引き伸ばすと、軽い処理で強くぼかせる
        const tctx = get2d(tiny);
        const k = Math.max(tiny.width / sw, tiny.height / sh);
        tctx.drawImage(src, (tiny.width - sw * k) / 2, (tiny.height - sh * k) / 2, sw * k, sh * k);
        get2d(mid).drawImage(tiny, 0, 0, mid.width, mid.height);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(mid, 0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(0, 0, W, H);
      } else {
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#f6d9c7');
        bg.addColorStop(1, '#d9c7e8');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
      }
    };
    const drawFramed = (
      img: CanvasImageSource,
      iw: number,
      ih: number,
      pxPerMm: number,
      origin: { x: number; y: number },
      cacheFrame: boolean,
    ) => {
      if (opts.aspect !== 'film') drawBackground(img, iw, ih);
      renderDocument(ctx, doc, { image: img, width: iw, height: ih }, { pxPerMm, origin, cacheFrame });
    };

    // ---- 再生前：サムネ（選んだ1コマ）を見せる ----
    // モードA：フレームの中でサムネを止めて見せる / モードB：サムネのフレームの中へ入り込む
    {
      opts.onProgress({ done: 0, total: totalFrames, stage: 'サムネ' });
      const size = winPx(opts.mode === 'B' ? zoomPx : fitPx);
      const stillSink = new CanvasSink(vTrack, { width: size.w, height: size.h, fit: 'cover' });
      const still = await stillSink.getCanvas(Math.min(opts.thumbTime, Math.max(0, srcDuration - 0.05)));
      if (!still) throw new Error('1コマ目を取り出せませんでした');
      const stillCanvas = still.canvas as HTMLCanvasElement;
      if (opts.cpuFilter) filterCanvasInPlace(stillCanvas, 'film', 1);
      const introFrames = Math.round(offset * opts.fps);
      for (let i = 0; i < introFrames; i++) {
        check();
        const t = i / opts.fps;
        if (opts.mode === 'A') {
          drawFramed(stillCanvas, stillCanvas.width, stillCanvas.height, fitPx, fitOrigin, true);
          await videoSource.add(t, frameDur);
          frames++;
          opts.onProgress({ done: frames, total: totalFrames, stage: 'サムネ' });
          continue;
        }
        const z = t < INTRO_STILL ? 0 : easeInOut((t - INTRO_STILL) / INTRO_ZOOM);
        // 拡大率は対数で補間すると、等速で近づいていくように見える
        const k = fitPx * Math.pow(zoomPx / fitPx, z);
        const origin = {
          x: fitOrigin.x + (zoomOrigin.x - fitOrigin.x) * ((k - fitPx) / (zoomPx - fitPx)),
          y: fitOrigin.y + (zoomOrigin.y - fitOrigin.y) * ((k - fitPx) / (zoomPx - fitPx)),
        };
        drawFramed(stillCanvas, stillCanvas.width, stillCanvas.height, k, origin, false);
        await videoSource.add(t, frameDur);
        frames++;
        await pumpAudio(t);
        opts.onProgress({ done: frames, total: totalFrames, stage: 'サムネ' });
      }
    }

    // ---- 本編 ----
    const mainPx = opts.mode === 'A' ? fitPx : zoomPx;
    const size = opts.mode === 'A' ? winPx(fitPx) : { w: W, h: H };
    const sink = new CanvasSink(vTrack, { width: size.w, height: size.h, fit: 'cover', poolSize: 3 });
    let nextT = 0;
    for await (const wc of sink.canvases(0, mainDuration)) {
      check();
      // 60fps の動画は 30fps に間引く
      if (wc.timestamp + 1e-6 < nextT) continue;
      nextT = Math.floor(wc.timestamp * opts.fps + 1e-6) / opts.fps + frameDur;
      const img = wc.canvas as HTMLCanvasElement;
      if (opts.cpuFilter) filterCanvasInPlace(img, 'film', 1);
      if (opts.mode === 'A') {
        drawFramed(img, img.width, img.height, mainPx, fitOrigin, true);
      } else {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(img, 0, 0, W, H);
      }
      const t = wc.timestamp + offset;
      await videoSource.add(t, frameDur);
      frames++;
      await pumpAudio(t);
      opts.onProgress({ done: frames, total: totalFrames, stage: '本編' });
    }
    await pumpAudio(Infinity);
    videoSource.close();
    audioSource?.close();
    opts.onProgress({ done: totalFrames, total: totalFrames, stage: '仕上げ' });
    await output.finalize();
    const buf = (output.target as BufferTarget).buffer;
    if (!buf) throw new Error('書き出しに失敗しました');
    canvas.width = 0;
    canvas.height = 0;
    return {
      blob: new Blob([buf], { type: 'video/mp4' }),
      width: W,
      height: H,
      outputSeconds: total,
      frames,
      elapsedMs: performance.now() - t0,
      audio: audioMode,
      videoCodec: codec === 'avc' ? 'H.264' : `${codec}（H.264が使えないため代わり）`,
    };
  } catch (e) {
    if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => {});
    throw e;
  } finally {
    input.dispose();
  }
}

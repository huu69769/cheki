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
import { VIDEO_FPS, VIDEO_THUMB_SECONDS, VIDEO_ZOOM_SECONDS } from '../../config';
import { GLFilter } from '../filters/glFilter';
import { ensureFontLoaded, getFont } from '../fonts/fonts';
import { FRAME_SHAPES } from '../frames/shapes';
import type { PhotoDoc } from '../model/types';
import { filterCanvasInPlace } from '../render/photoSource';
import { coverScale, renderDocument } from '../render/renderer';
import { createCanvas, get2d, releaseCanvas } from '../util/canvas';
import { effectiveThumbTime, videoOutputSize } from '../video/videoLayout';

/**
 * 編集した動画を MP4（H.264 + AAC）に書き出す。
 * 映像：元の動画のコマを取り出し → フィルター（GPU）→ 写真と同じ描画エンジンでフレームに合成 → H.264 に圧縮
 * 音声：元の AAC をそのままコピーし、時刻だけずらす（作り直さないので速く、音質も落ちない）
 */

export interface VideoExportProgress {
  done: number;
  total: number;
}

export interface VideoExportOptions {
  onProgress: (p: VideoExportProgress) => void;
  signal: { cancelled: boolean };
}

export interface VideoExportResult {
  blob: Blob;
  mimeType: string;
  filename: string;
  width: number;
  height: number;
  /** 音が入っているか（元の動画に音がない、または AAC 以外のときは入らない） */
  hasAudio: boolean;
}

export class VideoExportCancelled extends Error {
  constructor() {
    super('書き出しをキャンセルしました');
  }
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function timestamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** 「フィルムの形そのまま」以外のときの、フレームのまわりの背景（パステル） */
function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#f6d9c7');
  bg.addColorStop(1, '#d9c7e8');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
}

export async function exportVideo(file: Blob, doc: PhotoDoc, opts: VideoExportOptions): Promise<VideoExportResult> {
  const v = doc.video;
  if (!v) throw new Error('動画の設定がありません');
  await Promise.all(
    doc.layers.map((l) => (l.kind === 'text' ? ensureFontLoaded(getFont(l.fontId), l.text) : Promise.resolve())),
  );

  const shape = FRAME_SHAPES[doc.frame.shapeId];
  const win = shape.window;
  const aspect = v.mode === 'A' ? v.aspectA : v.aspectB;
  const { w: W, h: H } = videoOutputSize(aspect, doc.frame.shapeId);
  const filmOnly = aspect === 'film';

  // フレーム全体が収まる置き方（フィルムの形そのままのときは余白なし）
  const fitPx = filmOnly ? Math.min(W / shape.width, H / shape.height) : Math.min((W * 0.86) / shape.width, (H * 0.8) / shape.height);
  const fitOrigin = { x: (W - shape.width * fitPx) / 2, y: (H - shape.height * fitPx) / 2 };
  // 窓が画面いっぱいになる置き方（モードBの入り込んだあと）
  const zoomPx = Math.max(W / win.w, H / win.h);
  const zoomOrigin = { x: W / 2 - (win.x + win.w / 2) * zoomPx, y: H / 2 - (win.y + win.h / 2) * zoomPx };

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const gl = GLFilter.create();
  const canvas = createCanvas(W, H);
  try {
    const vTrack = await input.getPrimaryVideoTrack();
    if (!vTrack) throw new Error('動画の映像が見つかりません');
    if (!(await vTrack.canDecode())) throw new Error('この端末では、この動画を読み込めません');
    const aTrack = await input.getPrimaryAudioTrack();
    const rotation = await vTrack.getRotation();
    const sw = await vTrack.getSquarePixelWidth();
    const sh = await vTrack.getSquarePixelHeight();
    const dispW = rotation % 180 ? sh : sw;
    const dispH = rotation % 180 ? sw : sh;

    const trimStart = v.trimStart;
    const trimEnd = v.trimEnd;
    const mainLen = Math.max(0, trimEnd - trimStart);
    const offset = v.mode === 'B' ? VIDEO_THUMB_SECONDS + VIDEO_ZOOM_SECONDS : 0;
    const totalFrames = Math.ceil((offset + mainLen) * VIDEO_FPS);
    const frameDur = 1 / VIDEO_FPS;

    // 取り出すコマの大きさ：書き出しで実際に使う大きさまで（大きすぎると重いだけ）
    const maxPxPerMm = v.mode === 'B' ? zoomPx : fitPx;
    const need = coverScale(win, dispW, dispH) * doc.photo.scale * maxPxPerMm;
    const k = Math.min(1, need * 1.05, 1920 / Math.max(dispW, dispH));
    const grabW = Math.max(2, Math.round(dispW * k));
    const grabH = Math.max(2, Math.round(dispH * k));

    const ctx = get2d(canvas);
    const codec = await getFirstEncodableVideoCodec(['avc', 'vp9'], { width: W, height: H });
    if (!codec) throw new Error('この端末では動画を書き出せません');
    const videoSource = new CanvasSource(canvas, { codec, quality: new Quality('high'), keyFrameInterval: 2 });
    output.addVideoTrack(videoSource, { frameRate: VIDEO_FPS });

    // ---- 音声（元の AAC をそのままコピー） ----
    let audioSource: EncodedAudioPacketSource | null = null;
    let packets: AsyncGenerator<EncodedPacket> | null = null;
    const audioConfig = aTrack ? await aTrack.getDecoderConfig() : null;
    if (aTrack && audioConfig && (await aTrack.getCodec()) === 'aac') {
      const sinkA = new EncodedPacketSink(aTrack);
      const first = await sinkA.getPacket(trimStart);
      audioSource = new EncodedAudioPacketSource('aac');
      output.addAudioTrack(audioSource);
      packets = first ? sinkA.packets(first) : sinkA.packets();
    }
    await output.start();

    let pending: EncodedPacket | null = null;
    let audioDone = !audioSource;
    let metaSent = false;
    const pumpAudio = async (upTo: number) => {
      if (audioDone || !audioSource || !packets) return;
      for (;;) {
        if (!pending) {
          const r = await packets.next();
          if (r.done) {
            audioDone = true;
            return;
          }
          pending = r.value;
        }
        const p: EncodedPacket = pending;
        if (p.timestamp >= trimEnd) {
          audioDone = true;
          return;
        }
        const t = p.timestamp - trimStart + offset;
        if (t > upTo) return;
        pending = null;
        if (p.timestamp < trimStart) continue;
        const moved = p.clone({ timestamp: t });
        if (!metaSent) {
          await audioSource.add(moved, { decoderConfig: audioConfig! });
          metaSent = true;
        } else {
          await audioSource.add(moved);
        }
      }
    };

    let frames = 0;
    const check = () => {
      if (opts.signal.cancelled) throw new VideoExportCancelled();
    };
    const filtered = (img: HTMLCanvasElement): HTMLCanvasElement => {
      const { filterId, filterStrength } = doc.effects;
      if (gl) return gl.apply(img, img.width, img.height, filterId, filterStrength) ?? img;
      filterCanvasInPlace(img, filterId, filterStrength);
      return img;
    };
    const drawFramed = (img: HTMLCanvasElement, pxPerMm: number, origin: { x: number; y: number }, cacheFrame: boolean) => {
      if (!filmOnly) drawBackground(ctx, W, H);
      else {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, W, H);
      }
      renderDocument(ctx, doc, { image: filtered(img), width: dispW, height: dispH }, { pxPerMm, origin, cacheFrame });
    };
    const sink = new CanvasSink(vTrack, { width: grabW, height: grabH, fit: 'fill', poolSize: 3 });

    // ---- モードB：サムネを止めて見せる → フレームの中へ入り込む ----
    if (v.mode === 'B') {
      const still = await sink.getCanvas(effectiveThumbTime(v));
      if (!still) throw new Error('サムネの場面を取り出せませんでした');
      const stillCanvas = createCanvas(grabW, grabH);
      get2d(stillCanvas).drawImage(still.canvas as HTMLCanvasElement, 0, 0);
      const n = Math.round(offset * VIDEO_FPS);
      for (let i = 0; i < n; i++) {
        check();
        const t = i / VIDEO_FPS;
        const z = t < VIDEO_THUMB_SECONDS ? 0 : easeInOut(Math.min(1, (t - VIDEO_THUMB_SECONDS) / VIDEO_ZOOM_SECONDS));
        // 拡大率は対数で補間すると、等速で近づいていくように見える
        const kz = fitPx * Math.pow(zoomPx / fitPx, z);
        const u = zoomPx === fitPx ? 0 : (kz - fitPx) / (zoomPx - fitPx);
        const origin = { x: fitOrigin.x + (zoomOrigin.x - fitOrigin.x) * u, y: fitOrigin.y + (zoomOrigin.y - fitOrigin.y) * u };
        drawFramed(stillCanvas, kz, origin, z === 0);
        await videoSource.add(t, frameDur);
        frames++;
        opts.onProgress({ done: frames, total: totalFrames });
      }
      releaseCanvas(stillCanvas);
    }

    // ---- 本編（使う範囲を最初から） ----
    const mainPx = v.mode === 'A' ? fitPx : zoomPx;
    const mainOrigin = v.mode === 'A' ? fitOrigin : zoomOrigin;
    let nextT = trimStart;
    for await (const wc of sink.canvases(trimStart, trimEnd)) {
      check();
      // 60fps などの動画は 30fps に間引く
      if (wc.timestamp + 1e-6 < nextT) continue;
      nextT = trimStart + (Math.floor((wc.timestamp - trimStart) * VIDEO_FPS + 1e-6) + 1) / VIDEO_FPS;
      drawFramed(wc.canvas as HTMLCanvasElement, mainPx, mainOrigin, true);
      const t = Math.max(offset, wc.timestamp - trimStart + offset);
      await videoSource.add(t, frameDur);
      frames++;
      await pumpAudio(t);
      opts.onProgress({ done: Math.min(frames, totalFrames), total: totalFrames });
    }
    await pumpAudio(Infinity);
    check();
    videoSource.close();
    audioSource?.close();
    await output.finalize();
    const buf = (output.target as BufferTarget).buffer;
    if (!buf) throw new Error('書き出しに失敗しました');
    return {
      blob: new Blob([buf], { type: 'video/mp4' }),
      mimeType: 'video/mp4',
      filename: `film-${timestamp()}.mp4`,
      width: W,
      height: H,
      hasAudio: metaSent,
    };
  } catch (e) {
    if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => {});
    throw e;
  } finally {
    input.dispose();
    gl?.dispose();
    releaseCanvas(canvas);
  }
}

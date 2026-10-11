import { ALL_FORMATS, AudioBufferSink, BlobSource, CanvasSink, Input, type InputAudioTrack, type InputVideoTrack } from 'mediabunny';
import { createCanvas, get2d } from '../util/canvas';

/**
 * 動画の読み込みと、編集画面でのプレビュー再生。
 *
 * <video> 要素は使わず、書き出しと同じ方法（WebCodecs + Mediabunny）で動画からコマを取り出して表示する。
 * iPhone の Safari では、見えていない <video> の絵の更新が止まることがあり、
 * シークバーと絵がずれる原因になったため（検証ページで確認済み）。
 * 音は Web Audio で鳴らし、その時計に絵を合わせる。
 */

export interface VideoInfo {
  /** 長さ（秒） */
  duration: number;
  /** 表示したときの幅・高さ（回転を反映済み） */
  width: number;
  height: number;
  videoCodec: string | null;
  canDecodeVideo: boolean;
  hasAudio: boolean;
  /** プレビューで音を鳴らせるか */
  canDecodeAudio: boolean;
  /** 書き出しで音を入れられるか（AAC のみ、元の音をそのままコピーする） */
  audioIsAac: boolean;
}

/** この端末で動画を扱えるか（WebCodecs に対応しているか） */
export function videoSupported(): boolean {
  return typeof VideoDecoder !== 'undefined' && typeof VideoEncoder !== 'undefined';
}

export class VideoMedia {
  readonly file: Blob;
  readonly input: Input;
  readonly video: InputVideoTrack;
  readonly audio: InputAudioTrack | null;
  readonly info: VideoInfo;

  private constructor(file: Blob, input: Input, video: InputVideoTrack, audio: InputAudioTrack | null, info: VideoInfo) {
    this.file = file;
    this.input = input;
    this.video = video;
    this.audio = audio;
    this.info = info;
  }

  static async open(file: Blob): Promise<VideoMedia> {
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    try {
      const video = await input.getPrimaryVideoTrack();
      if (!video) throw new Error('この動画は読み込めませんでした（映像が見つかりません）');
      const audio = await input.getPrimaryAudioTrack();
      const rotation = await video.getRotation();
      const w = await video.getSquarePixelWidth();
      const h = await video.getSquarePixelHeight();
      const rotated = rotation % 180 !== 0;
      const info: VideoInfo = {
        duration: await input.computeDuration(),
        width: rotated ? h : w,
        height: rotated ? w : h,
        videoCodec: await video.getCodecParameterString(),
        canDecodeVideo: await video.canDecode(),
        hasAudio: !!audio,
        canDecodeAudio: audio ? await audio.canDecode().catch(() => false) : false,
        audioIsAac: audio ? (await audio.getCodec()) === 'aac' : false,
      };
      return new VideoMedia(file, input, video, audio, info);
    } catch (e) {
      input.dispose();
      throw e;
    }
  }

  dispose() {
    this.input.dispose();
  }
}

/** プレビューのコマの長辺（px）。画面に出す大きさには十分で、処理が軽い大きさ */
const PREVIEW_LONG_SIDE = 960;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PlayerCallbacks {
  /** 新しいコマを表示するとき */
  onFrame: (frame: HTMLCanvasElement, time: number) => void;
  onPlayingChange: (playing: boolean) => void;
}

export class VideoPlayer {
  readonly media: VideoMedia;
  private sink: CanvasSink;
  private audioSink: AudioBufferSink | null;
  private cb: PlayerCallbacks;

  /** いま表示しているコマ（コピー） */
  frame: HTMLCanvasElement | null = null;
  time = 0;
  playing = false;
  private muted = false;
  private rangeStart = 0;
  private rangeEnd: number;

  private token = 0;
  private seekState: { pending: number | null; busy: boolean } = { pending: null, busy: false };
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private nodes = new Set<AudioBufferSourceNode>();

  constructor(media: VideoMedia, cb?: PlayerCallbacks) {
    this.media = media;
    this.cb = cb ?? { onFrame: () => {}, onPlayingChange: () => {} };
    const { width, height } = media.info;
    const k = Math.min(1, PREVIEW_LONG_SIDE / Math.max(width, height));
    this.sink = new CanvasSink(media.video, {
      width: Math.max(2, Math.round(width * k)),
      height: Math.max(2, Math.round(height * k)),
      fit: 'fill',
      poolSize: 3,
    });
    this.audioSink = media.audio && media.info.canDecodeAudio ? new AudioBufferSink(media.audio) : null;
    this.rangeEnd = media.info.duration;
  }

  /** コマや再生状態の知らせ先を変える（編集画面が表示されたときに設定する） */
  setCallbacks(cb: PlayerCallbacks) {
    this.cb = cb;
  }

  /** 再生する範囲（使う範囲）を決める。いまの位置が外なら始まりに移る */
  setRange(start: number, end: number) {
    const changed = start !== this.rangeStart || end !== this.rangeEnd;
    this.rangeStart = start;
    this.rangeEnd = end;
    if (changed && (this.time < start || this.time > end)) void this.seek(start);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.gain) this.gain.gain.value = m ? 0 : 1;
  }

  private publish(src: HTMLCanvasElement, time: number) {
    // 取り出したコマの canvas は使い回されるので、表示用にコピーして持つ
    let c = this.frame;
    if (!c || c.width !== src.width || c.height !== src.height) c = createCanvas(src.width, src.height);
    get2d(c).drawImage(src, 0, 0);
    this.frame = c;
    this.time = time;
    this.cb.onFrame(c, time);
  }

  /** 指定した時刻のコマを表示する。続けて呼ばれたときは、最後の時刻だけを表示する */
  async seek(t: number): Promise<void> {
    if (this.playing) this.pause();
    const target = Math.max(this.rangeStart, Math.min(t, this.rangeEnd - 0.01));
    this.time = target;
    const st = this.seekState;
    st.pending = target;
    if (st.busy) return;
    st.busy = true;
    try {
      while (st.pending !== null) {
        const want = st.pending;
        st.pending = null;
        const wc = await this.sink.getCanvas(want);
        if (wc && st.pending === null) this.publish(wc.canvas as HTMLCanvasElement, want);
      }
    } catch {
      // 動画を閉じたあとなど
    } finally {
      st.busy = false;
    }
  }

  /**
   * 再生する。音を鳴らすため、ボタンを押した処理の中で呼ぶこと（iPhone の制限）。
   */
  play() {
    if (this.playing) return;
    if (this.audioSink && !this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.muted ? 0 : 1;
      this.gain.connect(this.ctx.destination);
    }
    void this.ctx?.resume();
    let start = this.time;
    if (start >= this.rangeEnd - 0.05 || start < this.rangeStart) start = this.rangeStart;
    void this.run(start);
  }

  pause() {
    this.token++;
    this.stopAudio();
    if (this.playing) {
      this.playing = false;
      this.cb.onPlayingChange(false);
    }
  }

  private stopAudio() {
    for (const n of this.nodes) {
      try {
        n.stop();
      } catch {
        // すでに止まっている
      }
    }
    this.nodes.clear();
  }

  private async run(start: number) {
    const token = ++this.token;
    this.playing = true;
    this.cb.onPlayingChange(true);
    const end = this.rangeEnd;
    // 時計：音があるときは AudioContext の時刻、ないときは performance.now()
    const ctx = this.ctx;
    const ctxStart = ctx ? ctx.currentTime + 0.05 : 0;
    const wallStart = performance.now() + 50;
    const now = () => (ctx ? start + (ctx.currentTime - ctxStart) : start + (performance.now() - wallStart) / 1000);

    if (ctx && this.audioSink && this.gain) void this.runAudio(token, start, end, ctx, ctxStart, now);

    try {
      for await (const wc of this.sink.canvases(start, end)) {
        if (token !== this.token) return;
        // そのコマの時刻になるまで待つ
        for (;;) {
          const wait = wc.timestamp - now();
          if (wait <= 0.005) break;
          await sleep(Math.min(wait * 1000, 50));
          if (token !== this.token) return;
        }
        this.publish(wc.canvas as HTMLCanvasElement, wc.timestamp);
      }
    } catch {
      if (token !== this.token) return;
    }
    if (token !== this.token) return;
    // 終わりまで来たら、始まりに戻ってくり返す
    this.stopAudio();
    void this.run(this.rangeStart);
  }

  private async runAudio(
    token: number,
    start: number,
    end: number,
    ctx: AudioContext,
    ctxStart: number,
    now: () => number,
  ) {
    try {
      for await (const wb of this.audioSink!.buffers(start, end)) {
        if (token !== this.token) return;
        // 先読みしすぎないように、1秒先までに抑える
        while (wb.timestamp - now() > 1) {
          await sleep(100);
          if (token !== this.token) return;
        }
        const node = ctx.createBufferSource();
        node.buffer = wb.buffer;
        node.connect(this.gain!);
        const at = ctxStart + (wb.timestamp - start);
        if (at >= ctx.currentTime) node.start(at);
        else {
          const offset = ctx.currentTime - at;
          if (offset < wb.duration) node.start(ctx.currentTime, offset);
          else continue;
        }
        this.nodes.add(node);
        node.onended = () => this.nodes.delete(node);
      }
    } catch {
      // 音が読めなくても、絵の再生は続ける
    }
  }

  dispose() {
    this.pause();
    void this.ctx?.close();
    this.ctx = null;
    if (this.frame) {
      this.frame.width = 0;
      this.frame.height = 0;
    }
  }
}

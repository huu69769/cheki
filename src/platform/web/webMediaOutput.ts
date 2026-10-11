import type { MediaOutput, OutputFile, SaveResult, ShareResult } from '../types';

function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS は Mac として振る舞うので、タッチ対応かどうかでも判定する
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function toFile(file: OutputFile): File {
  return new File([file.blob], file.filename, { type: file.mimeType });
}

/** Web版の保存・共有。保存はブラウザのダウンロード、共有は Web Share API を使う */
export const webMediaOutput: MediaOutput = {
  saveDescription(file) {
    const isVideo = file.mimeType.startsWith('video/');
    if (isIOS()) {
      return isVideo
        ? '「保存」はファイルアプリの「ダウンロード」に保存されます。写真アプリに入れたいときは「共有」→「ビデオを保存」を選んでください。'
        : '「保存」はファイルアプリの「ダウンロード」に保存されます。写真アプリに入れたいときは「共有」→「画像を保存」を選んでください。';
    }
    return '「保存」は端末の「ダウンロード」フォルダに保存されます（ギャラリーアプリの「Download」から見られます）。';
  },

  async save(file): Promise<SaveResult> {
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // すぐに解放するとダウンロードが失敗する端末があるので、少し待ってから解放する
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { kind: 'downloaded' };
  },

  canShare(file) {
    if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
    try {
      return navigator.canShare({ files: [toFile(file)] });
    } catch {
      return false;
    }
  },

  async share(file, opts): Promise<ShareResult> {
    try {
      // ボタンを押した直後でないと失敗するため、ここより前に await を入れないこと
      await navigator.share({ files: [toFile(file)], title: opts?.title });
      return { kind: 'shared' };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return { kind: 'cancelled' };
      throw e;
    }
  },
};

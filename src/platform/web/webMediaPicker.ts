import type { MediaPicker, PickedFile, PickSource } from '../types';

/**
 * <input type="file"> で写真・動画を選ぶ。
 * iOS Safari では、ボタンを押した処理の中で同期的に click() を呼ぶ必要がある
 * （await を挟むと開かない）ので、この関数は最初に click() まで済ませる。
 */
function pickFile(accept: string, source: PickSource): Promise<PickedFile | null> {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  if (source === 'camera') input.setAttribute('capture', 'environment');
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  input.style.opacity = '0';
  document.body.appendChild(input);

  return new Promise<PickedFile | null>((resolve) => {
    let done = false;
    const finish = (v: PickedFile | null) => {
      if (done) return;
      done = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(v);
    };
    // 'cancel' イベントに対応していない古いブラウザ向け：画面に戻ってきても選ばれていなければキャンセル扱い
    const onFocus = () => {
      window.setTimeout(() => {
        if (!input.files || input.files.length === 0) finish(null);
      }, 1500);
    };
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      finish(f ? { blob: f, name: f.name, mimeType: f.type, lastModified: f.lastModified } : null);
    });
    input.addEventListener('cancel', () => finish(null));
    window.addEventListener('focus', onFocus);
    input.click();
  });
}

export const webMediaPicker: MediaPicker = {
  pickImage: (source) => pickFile('image/*', source),
  pickVideo: (source) => pickFile('video/*', source),
};

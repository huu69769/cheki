import type { Platform } from './types';
import { webDraftStore } from './web/webDraftStore';
import { webMediaOutput } from './web/webMediaOutput';
import { webMediaPicker } from './web/webMediaPicker';

/**
 * 使う実装をここで選ぶ。
 * アプリ化するときは、Capacitor 上で動いているか（Capacitor.isNativePlatform()）を見て
 * capacitorPlatform に切り替える。それ以外のファイルは変更不要。
 */
const webPlatform: Platform = {
  kind: 'web',
  media: webMediaPicker,
  output: webMediaOutput,
  drafts: webDraftStore,
};

export const platform: Platform = webPlatform;

export type * from './types';

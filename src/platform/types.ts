/**
 * 端末に依存する処理のインターフェース。
 * 画面や編集ロジックからは、必ずこのインターフェース経由で呼ぶ。
 * いまは Web 版（platform/web）だけ。アプリ化するときは platform/capacitor を作って
 * platform/index.ts で切り替える（docs/mobile-plan.md 参照）。
 */

/** 端末から読み込んだファイル */
export interface PickedFile {
  blob: Blob;
  name: string;
  mimeType: string;
  /** ファイルの更新日時（ミリ秒）。撮影日の代わりに使うことがある */
  lastModified?: number;
}

export type PickSource = 'camera' | 'library';

export interface MediaPicker {
  /** 写真を1枚選ぶ／撮る。キャンセルされたら null */
  pickImage(source: PickSource): Promise<PickedFile | null>;
  /** 動画を1本選ぶ／撮る（フェーズ2で使用） */
  pickVideo(source: PickSource): Promise<PickedFile | null>;
}

/** 書き出したファイル */
export interface OutputFile {
  blob: Blob;
  filename: string;
  mimeType: string;
}

export type SaveResult =
  /** 写真アプリ（ギャラリー）に保存した */
  | { kind: 'saved-to-gallery' }
  /** ブラウザのダウンロードとして保存した */
  | { kind: 'downloaded' }
  | { kind: 'cancelled' };

export type ShareResult = { kind: 'shared' } | { kind: 'cancelled' };

export interface MediaOutput {
  /** 保存の説明（「ファイルアプリの『ダウンロード』に保存されます」など）。画面に表示する */
  saveDescription(file: OutputFile): string;
  save(file: OutputFile): Promise<SaveResult>;
  /** このファイルを共有（SNSなどへ送る）できるか */
  canShare(file: OutputFile): boolean;
  /**
   * 共有する。Web版では、ボタンを押した直後に呼ぶ必要がある（await を挟まない）。
   */
  share(file: OutputFile, opts?: { title?: string }): Promise<ShareResult>;
}

/** 下書き */
export interface Draft<TDoc = unknown> {
  id: string;
  kind: 'photo' | 'video';
  updatedAt: number;
  doc: TDoc;
  /** 元の写真・動画 */
  source: Blob;
  sourceName: string;
}

export interface DraftMeta {
  id: string;
  kind: 'photo' | 'video';
  updatedAt: number;
}

export interface DraftStore {
  /** 編集内容だけを保存（元の写真は saveSource で別に保存済み） */
  saveDoc(id: string, kind: Draft['kind'], doc: unknown): Promise<void>;
  saveSource(id: string, source: Blob, sourceName: string): Promise<void>;
  load(id: string): Promise<Draft | null>;
  list(): Promise<DraftMeta[]>;
  remove(id: string): Promise<void>;
}

export interface Platform {
  kind: 'web' | 'capacitor';
  media: MediaPicker;
  output: MediaOutput;
  drafts: DraftStore;
}

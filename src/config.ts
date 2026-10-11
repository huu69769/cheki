/** アプリ全体の設定値 */

/** アプリの名前（仮）。正式名称が決まったらここと index.html を変える */
export const APP_NAME = 'フィルムフレーム';

/** 写真の下書きの保存場所（いまは1件だけ保存する） */
export const PHOTO_DRAFT_ID = 'current-photo';

/** 動画の長さの上限（秒）。これより長い動画は「長さ」で使う部分を選ぶ */
export const MAX_VIDEO_SECONDS = 60;

/** 動画の使う範囲の最短（秒） */
export const MIN_VIDEO_SECONDS = 1;

/** モードB：入り込む前にサムネを止めて見せる長さ（秒） */
export const VIDEO_THUMB_SECONDS = 1;

/** モードB：サムネから中へ入り込むのにかける時間（秒） */
export const VIDEO_ZOOM_SECONDS = 1.2;

/** 書き出す動画のコマ数（1秒あたり） */
export const VIDEO_FPS = 30;

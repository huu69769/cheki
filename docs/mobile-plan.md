# アプリ化（Capacitor）の手順メモ

いまは Web アプリだけを作っています。ストアに出すときは Capacitor で包んで Android / iOS アプリにします。
このメモは「そのときに何をすればよいか」をまとめたものです（今回はまだ実施しません）。

## 前提

- **iOS アプリのビルドには Mac（Xcode）が必要**です。Windows だけの場合は、次のどれかが必要になります
  - クラウドのビルドサービス（例：Ionic Appflow、Codemagic、GitHub Actions の macOS ランナー）
  - Mac を借りる・レンタルする
- Android は Windows の Android Studio でビルドできます
- ストアの開発者登録（Apple Developer Program：年額、Google Play Console：初回のみ）が必要です

## 使うプラグイン

| 目的 | プラグイン | 差し替える場所 |
|---|---|---|
| 写真・動画を選ぶ／撮る | `@capacitor/camera`（写真）。動画は `@capawesome/capacitor-file-picker` など | `MediaPicker` |
| 写真アプリへの保存 | `@capacitor-community/media`（アルバムへ保存）、または `@capacitor/filesystem` + 共有 | `MediaOutput.save` |
| 共有（SNS などへ送る） | `@capacitor/share`（ファイルは一度 `@capacitor/filesystem` で一時保存して URI を渡す） | `MediaOutput.share` |
| 下書き | IndexedDB のままで動く。容量が心配なら `@capacitor/filesystem` に写真本体を置く | `DraftStore`（必要なら） |
| 判定 | `@capacitor/core` の `Capacitor.isNativePlatform()` | `src/platform/index.ts` |
| 動画の書き出し（フェーズ2） | まずは Web と同じ WebCodecs を使う。足りなければ自作のネイティブプラグイン（iOS: AVFoundation、Android: Media3 Transformer） | 動画の書き出し処理 |

## 差し替えの手順

1. Capacitor を入れる
   ```sh
   npm install @capacitor/core @capacitor/cli
   npx cap init "アプリ名" com.example.app --web-dir=dist
   npm install @capacitor/android @capacitor/ios
   npx cap add android
   npx cap add ios      # Mac が必要
   ```
2. `src/platform/capacitor/` を作り、`types.ts` のインターフェースどおりに実装する
   - `capacitorMediaPicker.ts`、`capacitorMediaOutput.ts`（下書きは Web 版をそのまま使ってよい）
3. `src/platform/index.ts` を次のようにする（ここ以外の画面・処理は変更不要）
   ```ts
   import { Capacitor } from '@capacitor/core';
   export const platform = Capacitor.isNativePlatform() ? capacitorPlatform : webPlatform;
   ```
4. 権限の説明文を設定する
   - iOS（`Info.plist`）：`NSPhotoLibraryAddUsageDescription`（保存）、`NSPhotoLibraryUsageDescription`（選択）、`NSCameraUsageDescription`（撮影）、`NSMicrophoneUsageDescription`（動画撮影時）
   - Android（`AndroidManifest.xml`）：カメラ、写真・動画の読み取り（Android 13 以降は `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO`）
5. `npm run build && npx cap sync` でアプリに反映し、Android Studio / Xcode で実機確認

## いまの設計で、アプリ化に向けて気をつけていること

- **相対パス**でビルドしている（`base: './'`）。Capacitor はローカルファイルとして読み込むため
- **URL で画面を切り替えていない**。アプリ内の状態で切り替えているので、ルーターの設定が不要
- **フォントは同梱**（外部の CDN を使わない）。オフラインでも文字入れができる
- **端末に依存する処理は `src/platform/` だけ**。画面や描画エンジンからは直接ブラウザの API（ダウンロード、Web Share など）を呼んでいない
- Web 版の「保存」はダウンロード扱い（iPhone ではファイルアプリ）。アプリ版では写真アプリに直接保存できるようになる

## ストア申請前に決めること・確認すること

- 正式なアプリ名（商標に注意。「チェキ」「instax」は使わない）。リポジトリ名・公開URLにも同じ名前が入っているので、公開前に変更を検討
- アイコン・スプラッシュ画像（`@capacitor/assets` で各サイズを作れる）
- プライバシーポリシー（写真を外部に送らないことを明記）
- 各ストアの「データの取り扱い」申告（収集なし）

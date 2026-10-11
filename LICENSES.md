# 素材・ライブラリのライセンス

このアプリで使っている素材と、その出典・ライセンスの一覧です。
**商用利用できるもの（ストアでの配布・販売を含む）だけ**を使っています。

## フォント

すべて npm の [@fontsource](https://fontsource.org/) パッケージ経由で同梱しています（Google Fonts と同じフォント）。
アプリの中では「このアプリについて・ライセンス」画面にも表示しています。

| フォント | 用途 | 著作権表示 | ライセンス | 出典 |
|---|---|---|---|---|
| Yomogi | 日本語・手書き風 | Copyright 2020 The Yomogi Project Authors | SIL Open Font License 1.1 | https://github.com/satsuyako/YomogiFont |
| Klee One (SemiBold) | 日本語・手書き（教科書体）風 | Copyright 2020 The Klee Project Authors | SIL Open Font License 1.1 | https://github.com/fontworks-fonts/Klee |
| Zen Kurenaido | 日本語・筆ペン手書き風 | Copyright 2021 The Zen Kurenaido Project Authors | SIL Open Font License 1.1 | https://github.com/googlefonts/zen-kurenaido |
| Hachi Maru Pop | 日本語・丸文字 | Copyright 2020 The Hachi Maru Pop Project Authors | SIL Open Font License 1.1 | https://github.com/noriokanisawa/HachiMaruPop |
| Zen Maru Gothic (Bold) | 日本語・丸ゴシック | Copyright 2021 The Zen Maru Gothic Authors | SIL Open Font License 1.1 | https://github.com/googlefonts/zen-marugothic |
| DotGothic16 | 日本語・ドット文字 | Copyright 2020 The DotGothic16 Project Authors | SIL Open Font License 1.1 | https://github.com/fontworks-fonts/DotGothic16 |
| Caveat (SemiBold) | 英字・手書き | Copyright 2014 The Caveat Project Authors | SIL Open Font License 1.1 | https://github.com/googlefonts/caveat |
| Pacifico | 英字・筆記体 | Copyright 2018 The Pacifico Project Authors | SIL Open Font License 1.1 | https://github.com/googlefonts/Pacifico |
| Permanent Marker | 英字・マーカー | Copyright (c) 2010 by Font Diner, Inc. | Apache License 2.0 | https://fonts.google.com/specimen/Permanent+Marker |

- SIL Open Font License 1.1：https://openfontlicense.org （フォントを使って作った画像・動画は自由に使えます。フォント単体での販売は不可）
- Apache License 2.0：https://www.apache.org/licenses/LICENSE-2.0
- ライセンス本文は、各パッケージの `node_modules/@fontsource/<名前>/LICENSE` にも入っています。

### 容量の工夫

日本語フォントは1書体で数MBあります。そこで：

- 1書体につき太さを1種類だけ使う
- フォントは「よく使う文字ごと」に細かく分割されたファイル（unicode-range）になっていて、**実際に入力した文字を含むファイルだけ**が読み込まれる
- 古い形式（woff）は配布物から外し、woff2 だけにしている（`vite.config.ts` の `woff2Only`）
- フォントの定義そのものも、最初の画面を表示したあとで読み込む

## オリジナル素材（このアプリのために作成）

以下は外部の画像などを使わず、すべてプログラムで描いています。第三者の権利はありません。

- フレームの色・柄（`src/core/frames/styles.ts`）
- スタンプ（`src/core/stamps/stamps.ts`）
- 日付の刻印の7セグメント数字（`src/core/render/dateStamp.ts`）
- 粒子・ビネット・光漏れ・紙の質感（`src/core/render/effects.ts`）
- フィルターの色の調整値（`src/core/filters/filters.ts`）
- アイコン（`src/ui/components/Icon.tsx`、`public/icon.svg`）

## ソフトウェア（ライブラリ）

| 名前 | ライセンス |
|---|---|
| React / React DOM | MIT |
| Mediabunny（動画の読み書き） | MPL-2.0（商用利用可。ライブラリ自体を改変した場合はその部分を公開。このアプリでは改変していない） |
| @fontsource/*（フォントの配布用パッケージ） | 中のフォントと同じ（上の表） |
| Vite, TypeScript, Vitest（開発用。アプリには含まれない） | MIT / Apache-2.0 |

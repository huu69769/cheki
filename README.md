# フィルムフレーム（仮）

写真を **インスタントカメラ風** に加工するスマホ向けアプリです。
いまは Web アプリとして作っていて、あとで Capacitor で包んで Android / iOS アプリにする予定です。

- 確認用URL（GitHub Pages）：https://huu69769.github.io/cheki/
- サーバーなし・ログインなし。写真は端末（ブラウザ）の中だけで処理し、外部に送信しません
- 編集途中の内容は端末内（IndexedDB）に自動で下書き保存します

## できること（フェーズ1：写真）

| 機能 | 状態 |
|---|---|
| 写真の読み込み（カメラで撮る／写真を選ぶ） | ✅ |
| フレームの形（ミニ・スクエア・ワイド）と色・柄 | ✅ |
| 窓の中で写真を指で移動・拡大・回転 | ✅ |
| 文字入れ（フォント・色・サイズ・位置・回転） | ✅ |
| フィルター・粒子・ビネット・光漏れ・日付刻印・スタンプ | ✅ |
| 元に戻す／やり直し | ✅ |
| 書き出し → プレビュー → 保存・共有・編集に戻る | 作業中 |

フェーズ2（動画）は、フェーズ1の完成後に着手します。技術検証の結果は `docs/phase2-video-research.md` にまとめます。

## 公開のしくみ

`main` ブランチに push すると、GitHub Actions（`.github/workflows/deploy.yml`）が自動でビルドして GitHub Pages に公開します。

### 最初に1回だけ必要な設定（リポジトリの持ち主が行う）

1. GitHub でこのリポジトリを開く
2. 上のメニューの **Settings**（設定）を押す
3. 左のメニューの **Pages** を押す
4. 「Build and deployment」の **Source** を **GitHub Actions** に変える（選ぶだけで保存されます）
5. 上のメニューの **Actions** を開き、失敗している「GitHub Pages に公開」を選んで、右上の **Re-run all jobs** を押す（設定前に動いた分のやり直し）
6. 数分後に https://huu69769.github.io/cheki/ を開いて表示されればOK

以降は push するたびに自動で更新されます（反映まで1〜3分ほど）。

## フォルダ構成

```
src/
  platform/        端末に依存する処理（写真の読み込み、保存・共有、下書き）。インターフェース経由で呼ぶ
    types.ts       インターフェース定義
    index.ts       どの実装を使うかをここで切り替える
    web/           Web版の実装
  core/            端末にもUIにも依存しない部分
    model/         編集データの型と操作
    render/        描画エンジン（プレビューと書き出しで共通）
    frames/        フレームの形・色柄
    filters/       色のフィルター
    stamps/        スタンプ
    fonts/         フォント一覧と読み込み
    history/       元に戻す／やり直し
  ui/              画面と部品（React）
docs/
  design.md        設計のまとめ
  mobile-plan.md   アプリ化（Capacitor）の手順
LICENSES.md        素材・ライブラリのライセンス
```

## 開発者向けメモ

```sh
npm install
npm run dev       # 開発用サーバー（同じWi-Fiのスマホから http://<PCのIP>:5173 で見られる）
npm test          # テスト
npm run build     # 本番用ビルド（dist/ に出力）
```

- 名称について：商標に配慮し、アプリ名・画面・説明文では「インスタントカメラ風」という言い方をしています
- 素材のライセンスは `LICENSES.md` を参照

<p align="center"><img src="docs/assets/logo-small.png" alt="MarkText" width="100" height="100"></p>

<h1 align="center">MarkText-ja</h1>

<div align="center">
  <strong>日本語ファーストの Markdown エディタ</strong><br>
  WYSIWYG で書ける、シンプルで高速なオープンソース Markdown エディタです。<br>
  <sub>Windows / macOS / Linux</sub>
</div>

## 概要

MarkText-ja は、オープンソースの Markdown エディタ MarkText を日本語で快適に使えるように整備したフォークです。翻訳だけでなく、日本語入力(IME)まわりの不具合修正、Shift_JIS / EUC-JP の自動判定の修正、日本語フォント・UI の既定化など、「日本語で使うと壊れる」箇所の修正を主眼にしています。

## スクリーンショット

![](docs/assets/marktext.png?raw=true)

## 特徴

- リアルタイムプレビュー(WYSIWYG)による、気の散らないシンプルな執筆体験
- [CommonMark](https://spec.commonmark.org) / [GitHub Flavored Markdown](https://github.github.com/gfm/) 対応、[Pandoc markdown](https://pandoc.org/MANUAL.html#pandocs-markdown) の一部対応
- 数式(KaTeX)・front matter・絵文字などの Markdown 拡張
- 段落・インライン書式のショートカット
- **HTML** / **PDF** 出力
- 複数テーマ(**Cadmium Light**、**Material Dark** など)
- **ソースコード** / **タイプライター** / **集中**の各編集モード
- クリップボードからの画像貼り付け

日本語まわりの主な改善:

- IME(日本語入力)での入力破壊・カーソル飛びの修正
- Shift_JIS / EUC-JP の自動判定の修正(文字化けしたまま保存して壊す問題の解消)
- UI の既定言語を日本語に、日本語フォントスタックを既定化
- 見出しスラッグ・単語数・検索など、CJK テキスト処理の修正

## ビルド

Node.js >= 20.19 と pnpm >= 10 が必要です。

```bash
pnpm install        # 依存関係のインストール
pnpm run dev        # 開発モードで起動
pnpm run build:win  # Windows 向けパッケージ(build:mac / build:linux もあり)
```

開発者向けの詳細は [`docs/dev/`](docs/dev/) を参照してください。

## ライセンス

[MIT](LICENSE)

本プロジェクトは [MarkText](https://github.com/marktext/marktext) のフォークです。原著作者およびコントリビューターのクレジットは [LICENSE](LICENSE) に維持されています。

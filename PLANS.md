# PLANS.md — MarkText 日本語対応フォーク計画

作成: 2026-07-29(調査セッションの記録)
対象: このリポジトリ = upstream `marktext/marktext` の `develop` スナップショット(HEAD `e52106fd`、remote 未設定)
参照資料: `issues/` = upstream 未解決 issue 514 件 + PR 49 件のスナップショット(2026-07-29 取得)

## 方針(決定事項)

- **Electron のまま進める**(Tauri 移行はしない)
- ターゲットプラットフォームは **Windows**
- 日本語対応は「翻訳」ではなく「バグ修正」が本体(翻訳は既にほぼ完了している — 下記)

---

## 調査結果サマリ

### 1. i18n の現状 — 翻訳はほぼ完了している

- `packages/desktop/static/locales/ja.json`: **745 キー完訳**(英語と同一の 37 件はすべてテーマ名等の固有名詞)
- `packages/muya/src/locales/ja.ts`: 85 キー完訳
- 言語ピッカーに「日本語」登録済み(`renderer/src/prefComponents/general/config.ts:123-126`)
- 初回起動時の OS 言語自動検出も `ja` 対応(`main/preferences/index.ts:196-228`)
- ロケール切替の e2e テストに ja ケースあり(`packages/muya/e2e/tests/i18n/locale-switch.spec.ts`)
- i18n は 3 系統: renderer = vue-i18n v11 / main = 自前 `t()`(`common/i18n.ts`)/ muya = 英文キーの自前辞書
- 新規ロケールは `pnpm run minify-locales` 必須(`electron-builder.yml` が `.min.json` 以外を除外)

未翻訳のハードコード英語は約 50〜70 箇所(全体の 5〜8%)に集中:

| 場所 | 内容 |
|---|---|
| `renderer/src/store/autoUpdates.ts:8,16,23,31` | 自動更新通知 4 件すべて(`t` 未 import) |
| `renderer/src/store/project.ts:226,245,247,258,287,289,303` | サイドバーのファイル操作エラー |
| `main/windows/editor.ts:220-221` | クラッシュダイアログ |
| `main/menu/actions/file.ts:44,51,97,134,172,356,543-544,707,732` | ダイアログのボタン/フィルタ名/'Untitled' |
| `main/menu/templates/dock.ts:6,16` | macOS Dock メニュー(Windows 版では無関係) |
| `renderer/src/commands/`(index.ts, lineEnding.ts, trailingNewline.ts, spellcheckerLanguage.ts) | コマンドパレット項目 |
| `packages/muya/src/ui/footnoteTool/index.ts:80,83,95` | 脚注ツール全体 |
| `packages/muya/src/ui/previewToolBar/index.ts:97` | `i18n.t` 未経由(en.ts にキー自体なし) |
| `packages/muya/src/ui/codeBlockLanguageSelector/index.ts:153` | 'No result' 生文字列 |
| `packages/muya/src/ui/emojiSelector/index.ts:64` | 絵文字検索が英語エイリアスのみ |
| `main/app/index.ts:374-375` | Windows ジャンプリスト |
| `renderer/src/util/pdf.ts:193` | PDF 目次見出し 'Table of Contents' |

### 2. IME(日本語入力)バグ — フォークの核

**upstream に未マージ修正 PR があるもの(cherry-pick 候補):**

| issue | PR | 内容 |
|---|---|---|
| #4956 | **#4957** | 変換中の Backspace/Delete でカーソル飛び。`packages/muya/src/block/base/content.ts:722-728` — Enter/矢印/Tab はガード済みなのに Backspace/Delete だけ `isComposed` チェック欠落(検証済み) |
| #4851 | **#4876** | コードブロック内で日本語入力破壊(`てすと`→`ｎあ`)。`codeBlockContent/index.ts:233-258` — compositionend で同期 innerHTML 再構築。旧エンジンの 300ms デバウンスが TS 化で消えた退行。`// TODO: throttle render` が :256 に現存。PR はメンテナ(Jocs)本人作 |
| #3822 | — | Linux/fcitx5 でコードブロック内入力破壊。#4851 と同根の可能性大 |
| #4926/#4892 | **#4931** | 絵文字削除でサロゲートペア分割 → "Invalid offset - splits unicode bytes" クラッシュ |

**新規発見(upstream に issue なし)— muya エンジン:**

- `packages/muya/src/block/content/langInputContent/index.ts:56-62` — コードフェンス言語入力欄だけ `isComposed` ガード完全欠落。変換 1 文字目で必ず破綻
- `packages/muya/src/ui/ui.ts:40-64` + `ui/baseScrollFloat/index.ts:35-63` — フロートメニュー(絵文字ピッカー/クイック挿入/言語セレクタ)が Enter/Escape/Tab/↑/↓ を composition 中でも横取り(= 日本語 IME の変換操作キー)
- `packages/muya/src/clipboard/index.ts:16-24,65-100` — 複数ブロック選択中に IME keydown(keyCode 229)が `cutHandler()` を発火
- `packages/muya/src/editor/index.ts:299-320` — compositionstart/end も選択範囲ゲートで drop される。compositionend が落ちると `isComposed=true` が固着しブロックが入力不能に(復帰手段なし)
- `packages/muya/src/block/content/tableCell/index.ts:254-272` — Safari 用 ZWSP ハックが全エンジンで無条件実行。compositionstart 中に DOM 書き換え

**新規発見 — デスクトップ側 UI:**

- `renderer/src/components/search/index.vue:309-313` — 検索ボックスの Enter に `isComposing` ガードなし → 変換確定で検索ジャンプ
- `renderer/src/components/commandPalette/index.vue:171-202` — `@keydown` の ↑/↓ にガードなし(`@keyup` 側 :205 にはある)
- `renderer/src/components/sideBar/tree.vue:105` / `rename/index.vue:18` — ファイル名入力・リネームの Enter にガードなし
- `renderer/src/prefComponents/keybindings/key-input-dialog.vue:120` — `FIXME` 現存。IME 有効時にキーバインド登録が壊れる

**日本語テキスト処理の劣化(composition と別系統):**

- `packages/muya/src/utils/slug.ts` — ASCII `\w` 前提。日本語見出しのスラッグが空 → TOC リンク破壊
- `packages/muya/src/utils/index.ts:183-197` — 単語数が `[一-龥]` のみ。**かなは対象外**、日本語段落全体が 1 語扱い
- `packages/muya/src/utils/search.ts:23` — 単語単位検索が `\b` 依存 → 日本語で常に 0 件
- `packages/muya/src/block/base/content.ts:136-150` — auto-pair の直前文字判定が ASCII のみ → `日本語*` 入力で `**` に過剰発火
- `packages/muya/src/block/base/content.ts:24-80` — 単語区切りに `。、「」・` 未対応 → 右クリック単語置換が無言で失敗
- `packages/muya/src/inlineRenderer/lexer.ts:201-208` — `午前:00-14:00` 等が誤絵文字トークン化
- CJK 対応強調判定(`utils/marked/extensions/cjkEmStrong.ts`)はエクスポート経路のみ。ライブ編集の inline tokenizer は未対応

### 3. エンコーディング — Shift_JIS 自動判定が壊れている(検証済み)

`packages/desktop/src/main/filesystem/encoding.ts:13-19`:

```ts
  // Map ASCII / subsets of UTF-8 to UTF-8.
  JIS: 'utf8',      // ISO-2022-JP → 誤り
  SJS: 'utf8',      // Shift_JIS   → 誤り
  shiftjis: 'utf8',
```

- ced の判定結果 SJS/JIS を UTF-8 に読み替えているため、Shift_JIS の .md を開くと文字化け → **保存で破壊**
- 中国語(`BIG5-CP950→big5`, `GB→gb2312`)・韓国語(`KSC→euckr`)は正しい。**日本語だけの穴**
- EUC-JP はマッピング表になくフォールバックで偶然動作。同関数の `.replace(/-_/g,'')` は `[-_]` の書き損じ
- `autoGuessEncoding` デフォルト true なので既定で踏む。Shift_JIS/EUC-JP のテストはゼロ
- 手動エンコーディング選択(設定/コマンドパレット)は正常動作

### 4. 日本語の表示・出力

- 全フォントスタックが Latin のみ(`renderer/src/config.ts:6-7`, `packages/muya/src/assets/styles/blockSyntax.css:3`, `util/pdf.ts:199-200`)。同梱フォントも latin サブセットのみ
- エクスポート HTML が `<html lang="en">` 固定(`packages/muya/src/state/markdownToHtml.ts:283`)→ **日本語 PDF が中国語字形になりうる**。アプリ本体 `index.html` にも lang 属性なし
- `electron-builder.yml:51-52` `electronLanguages: [en-US]` → ネイティブダイアログが日本語 OS でも英語。**`ja` 追加が必要**
- スペルチェッカーは en-US 専用化済み(`spellchecker/languageMap.ts:42-49`)→ 日本語文書で全文赤線。緩和策 `spellcheckHideMarks` は存在
- `packages/muya/src/assets/styles/inlineSyntax.css:547` `word-break: break-all` は禁則処理無視

### 5. データ損失級バグ(日本語と無関係、フォークの信頼性向上)

| ID | 内容 | 場所 |
|---|---|---|
| A1 | 保存ダイアログを Esc キャンセル → ウィンドウ強制クローズで文書消失。`.catch` の失敗ダイアログは到達不能デッドコード | `main/menu/actions/file.ts:407-456`(handleResponseForSave :192-195, :220-224 が resolve する) |
| A2 | プロジェクトを閉じる際、確認ダイアログ応答前に保存済みタブをクローズ。「キャンセル」でも戻らない | `renderer/src/store/editor.ts:705-709` |
| A4 | 改行コード/エンコーディング/最終改行の切替で `isSaved = true` を代入(ディスク未書き込み)→ 確認なしで閉じられ編集消失。クラッシュ復旧バッファも削除される(検証済み) | `renderer/src/store/editor.ts:1610,1632,1644` |
| A5 | 自動更新が保存を促さず `quitAndInstall()`(TODO コメントが defect を自認) | `main/menu/actions/marktext.ts:41-52` |
| A6 | リネーム/移動の失敗が完全に無言(EXDEV/EACCES) | `main/menu/actions/file.ts:502-514,549-561` |
| C1 | クラッシュ復旧バッファ破損 → タブ 0 個の空ウィンドウ、通知なし | `main/windows/editor.ts:566-641` |
| F1 | preferences.json の schema 違反 1 件で起動不能(process.exit(1))。`--safe` でも回避不可 | `main/preferences/index.ts:44-56` + `main/index.ts:95-113` |

### 6. セキュリティ

- **コマンドインジェクション**(検証済み): `main/ipc/uploader.ts:94-95` `exec(\`${cmd} u "${localPath}"\`)`。同ファイル `uploadByCli`(:109)の `execFile` 方式に合わせれば修正完了
- 格納型 XSS(画像属性値のエスケープ漏れ): upstream 未マージ PR **#4980** あり

### 7. その他の実バグ(抜粋)

- ripgrep stdout に `setEncoding('utf8')` なし → 64KiB チャンク境界でマルチバイト破壊。**日本語検索結果が化ける**。ファイル検索モードではパス自体が壊れ、クリックしても開かない(`main/ipc/ripgrep.ts:288-289,410-412`)。修正 1 行
- 同 `:59-69` ループ境界チェックなし → Shift_JIS ファイル検索で TypeError(catch に飲まれ「結果なし」に見える)
- 別パスへの Save As でウォッチャー抑止漏れ → 自分の書き込みを外部変更と誤認(`file.ts:383-386`)
- `_ignoreChangeEvents` 無期限成長(`filesystem/watcher.ts:403-457`)
- `Untitled-NaN` 採番バグ(`renderer/src/store/help.ts:96-106`)
- ユニットテストのテスト間状態リーク: `pdf.spec.ts` の 2 件がフルスイート実行時のみ失敗(単独実行では 16 件全通過)。既存問題

### 8. upstream 未マージ PR(cherry-pick 候補、バグ修正 23 件の主要分)

#4876(IME/コードブロック)、#4957(IME/Backspace)、#4931(サロゲートペア)、#4913(リストoutdentクラッシュ)、#4911(言語選択クラッシュ)、#4930(CodeMirror/Vue proxy)、#4942+#4946(巨大ファイルフリーズ)、#4952(テーブル列幅)、#4776(順序リストマーカー)、#4980(XSS)、#4322(初回言語検出)、#4873(Shift+数字キーバインド)、#4788/#4789/#4778(ネットワークFS)、#4773(URIError)

注意:
- issue の多くはリリース版への報告。**着手前に develop で再現確認**すること
- #4972(巨大テーブル)は旧エンジン `packages/muyajs` へのパッチで現構成に不適用。他 PR も対象パッケージ要確認

---

## サイズ最適化(実測済み・変更は一旦 revert 済み)

### 実測結果(Windows x64)

| | ベースライン | 最適化後 |
|---|---:|---:|
| win-unpacked | 451 MB | **336 MB** |
| app.asar | 142 MB | **27 MB**(−81%) |
| 配布 zip | — | **138 MB** |

原因: `dependencies` 57 個中、main/preload が実際に使うのは 18 個のみ。残り 38 個は renderer 専用で、Vite バンドル済みにもかかわらず生の node_modules としても二重同梱されていた(element-plus 23MB, mermaid 17MB, cytoscape 系 15MB など)。`test/` や tsconfig も同梱されていた。

### 再適用手順(2 ファイル)

1. `packages/desktop/package.json`: 以下の 38 個を `dependencies` → `devDependencies` に移動:
   `@electron-toolkit/preload, @element-plus/icons-vue, @intlify/core-base, @marktext/file-icons, @marktext/muyajs, @muyajs/core, @popperjs/core, axios, codemirror, deep-equal, dom-autoscroller, dompurify, dragula, element-plus, element-resize-detector, execall, flowchart.js, github-markdown-css, html-tags, iso-639-1, joplin-turndown-plugin-gfm, katex, lodash, mermaid, mitt, ms, pako, pinia, prismjs, snabbdom, snabbdom-to-html, snapsvg-cjs, turndown, underscore, vega-embed, vue-i18n, vue-router, webfontloader`
   (残す 18 個 = main/preload が import: `@electron-toolkit/utils, @hfelix/electron-localshortcut, @vscode/ripgrep, arg, ced, chokidar, command-exists, electron-log, electron-store, electron-updater, electron-window-state, font-list, fs-extra, fuzzaldrin, keytar, pathe, plist, write-file-atomic`)
2. `packages/desktop/electron-builder.yml` の `files:` に追加:
   ```yaml
   - '!{test,patches}'
   - '!{tsconfig.json,tsconfig.base.json,tsconfig.*.json,vitest.config.ts}'
   ```

### 検証済み事項

- typecheck 通過、ユニットテスト 732/734(失敗 2 件はベースラインでも同一失敗の既存 flake)
- main/preload の外部 require 17 個すべて trim 後 asar 内で解決(静的解析)
- 移動 38 個は main/preload から静的 require・動的 import とも参照ゼロ
- **trim 後の asar 展開物 + static/ で実起動確認済み**(エディタ UI マウントまで、Linux 環境)

### さらに削る場合(未適用)

- `dxcompiler.dll`(25MB)+ `dxil.dll`(1.5MB): WebGPU 用、afterPack で削除可
- `LICENSES.chromium.html`(20MB): 削除ではなく移設(ライセンス表示義務)
- `vk_swiftshader.dll` 等(6MB): GPU なし環境用のため削除非推奨
- 現実的な下限は 280〜290MB(残りは Chromium 本体 217MB)

### 実配布の注意

- 今回の Windows パッケージは Linux 上での計測目的ビルド。**ネイティブモジュール(ced/keytar 等)が Linux 用 ELF のまま**入っており、実配布物としては使えない。実配布は Windows 上(または CI)で `pnpm run build:win` すること
- `electronLanguages` に `ja` を追加すること(数百 KB 増、上表に含まず)

### Tauri 検討の結論

Windows 専用なら WebView2 = Chromium なので IME 懸念はほぼ消えるが、main プロセスの Rust 書き直し、PDF エクスポート(`printToPDF` 等価物なし、タグ付き PDF・アウトライン生成も使用中)、スペルチェッカー、ced/keytar/ripgrep/native-keymap の置き換えが必要。WebView2 ブートストラッパ同梱なら実質 +130MB。**見送り**。

---

## 今後の予定

### Phase 1 — 日本語入力の修正(フォークの核)
1. ~~PR #4876 / #4957 の cherry-pick + develop での再現確認~~ **完了**(2026-07-29)
   - #4957: PR は方針のみ参照し同等ガードを実装。ユニットテストで develop 再現→修正を確認(`imeBackspaceComposition.spec.ts`)
   - #4876: upstream diff を取得し `git apply`(clean)。レビュー済み(state 更新は同期のまま、DOM 再構築のみ 300ms 遅延/構造編集は同期維持/タイマーは isConnected+isComposed ガード付き)
   - #3822(Linux/fcitx5)は未検証 — #4851 と同根なら修正済みのはず。実機確認時に要検証
2. ~~Shift_JIS 自動判定修正~~ **完了**(2026-07-29)
   - `SJS→shiftjis` / `EUC-JP→eucjp` に修正(実 ced の返却名と一致することを実バイナリで確認)、`[-_]` 正規表現修正
   - `JIS`(ISO-2022-JP)は iconv-lite 非対応のため意図的に未マッピング化 — utf8 誤読で破壊保存するより「Cannot open tab」エラーに倒す(実ファイルは 7-bit なので isLikelyUtf8 で先に UTF-8 扱いになり実質到達不能)
   - テスト: `encoding-japanese.spec.ts` 5 ケース(実 Shift_JIS/EUC-JP バイト列のラウンドトリップ含む)
3. ~~`langInputContent` の isComposed ガード追加、フロートメニューの composition ガード~~ **完了**(2026-07-29)
   - langInputContent: isComposed ガード + IME 確定時は DOM 再構築なしで state のみ更新(#4876 と同機構)
   - フロート: `ui.ts` `handleContentKeydown` / `baseScrollFloat` ナビキー / `baseFloat` Escape の 3 箇所に isComposing ガード
4. ~~デスクトップ側 IME ガード~~ **完了**(2026-07-29)— 計画の 4 箇所に加え treeFile/treeFolder も発見し計 7 箇所:
   - search(Enter)、commandPalette(keydown ↑/↓)、tree.vue / treeFolder.vue(新規ファイル名 Enter ×2)、treeFile.vue / treeFolder.vue(リネーム Enter ×2)、rename/index.vue
   - rename は `@keyup.enter` だったため isComposing ガード不能(確定 Enter の keyup は compositionend 後で isComposing=false)→ keydown 化。keypress 系 4 箇所も deprecated のため keydown+ガードに統一
   - 未対応: `prefComponents/keybindings/key-input-dialog.vue:120` の FIXME(キーバインド登録ダイアログ)は Phase 4 で

### Phase 2 — 日本語の表示と出力
5. ~~フォントスタックに日本語フォント追加~~ **完了**(2026-07-29)— OS フォント指定(Win: Yu Gothic UI/Meiryo、mac: Hiragino、Linux: Noto Sans CJK JP)。総称ファミリの前に挿入し Latin グリフは従来どおり。エディタ(config.ts)/muya 既定(blockSyntax.css)/PDF(pdf.ts、印刷向けに非 UI 変種 Yu Gothic)の 3 箇所
6. ~~electronLanguages ja / lang 属性 / word-break~~ **完了**(2026-07-29)
   - `generate({ lang })` を muya に追加(既定 en で既存出力と同一、属性値は検証付き)→ desktop 3 経路(styledHtml/PDF/print)が UI 言語を渡す。`muya-core.d.ts` シムも更新
   - アプリ本体: index.html に lang="en" + `setLanguage()` で `document.documentElement.lang` を実行時更新
   - `word-break: break-all`(画像マーカーテキスト限定だった)→ `overflow-wrap: anywhere`(URL 折返し維持+禁則回復)
7. ~~slug / 単語数 / 単語単位検索 / auto-pair の CJK 対応~~ **完了**(2026-07-29)
   - slug: `\p{L}\p{M}\p{N}` ベースに(TOC とエクスポート HTML の id は単一実装なので一括修正)。旧仕様を固定していた getTOC.spec は新仕様に更新
   - 単語数: `[一-龥]` → Han/ひらがな/カタカナ/ハングルの Script プロパティ
   - 検索: 語端が ASCII 語構成文字の側にのみ `\b` を付与(CJK 語は部分一致に degrade、regexp モードは従来どおり)
   - auto-pair: 直前文字判定を `\p{L}\p{N}` に(`日本語*` の過剰発火解消。CJK 句読点後は発火維持)

### Phase 3 — データ損失バグの修正
8. ~~A1、A4、A2、A5~~ **完了**(2026-07-29)
   - A1: `handleResponseForSave` が saved/canceled/failed を返すよう変更。閉じる処理は全ファイル保存成功時のみ実行、失敗時は(旧・到達不能だった)失敗ダイアログ、キャンセルはクローズ中止。回帰テスト 6 件
   - A2: 保存済みタブは即クローズせず `savedTabIds` として main に委譲。ダイアログのキャンセルで全タブ生存。IPC 契約も更新。回帰テスト 4 件
   - A4: 3 箇所を `isSaved = false` に修正
   - A5: `quitAndInstall()` 直接呼び出しを廃止 → 「終了してインストール/後で」ダイアログ + 通常の `app.quit()`(未保存確認フローを通る)。「後で」は electron-updater の autoInstallOnAppQuit が次回終了時に適用。ロケールキー追加(全 10 言語)
9. ~~F1、C1~~ **完了**(2026-07-29)
   - F1: 壊れた preferences.json は `.corrupt-<ts>` に退避してデフォルトで再作成、エラーボックスで通知(起動は継続)。回帰テスト 2 件
   - C1: 復旧バッファ破損時はバッファを `.corrupt-<ts>` にコピー退避(次回 flush での上書き消失を防止)+ 通知 + 空タブで起動
10. ~~セキュリティ~~ **完了**(2026-07-29)
    - uploader: 画像を自前生成名の一時パスへコピーしてから実行(敵対的ファイル名の無害化)+ `execFile` 化。Windows の npm picgo.cmd シムのみ安全パスで shell フォールバック
    - PR #4980(XSS): muya 側ハンクのみ適用(muyajs 部分は削除済みで不要)。修正前に失敗することを確認した回帰テスト 2 件付き

### Phase 4 — 仕上げ
11. ~~ハードコード英語の t() 化~~ **完了**(2026-07-29)
    - desktop: autoUpdates(4)+main 送信文言、project.ts(6)、クラッシュダイアログ、file.ts(ダイアログ/フィルタ名/Untitled/リンク空白 9 箇所)、dock メニュー(ビルダー関数化して言語ロード後に解決)、ジャンプリスト、PDF 目次見出し、コマンドパレット(export HTML/PDF は getter 化、改行コード/最終改行/スペルチェッカー)
    - muya: footnoteTool(4)、previewToolBar tooltip、codeBlockLanguageSelector 'No result'。ロケール 10 言語すべてにキー追加(ja は翻訳、他は英語。muya は en の型が全ロケールの契約なので全ファイル必須)
    - 未対応(意図的): emojiSelector の日本語絵文字検索は「機能追加」なので別途
12. ~~PR 取り込み~~ **完了**(2026-07-29)
    - #4946 適用(#4942 をスタック済みのため #4946 のみで両方入る。upstream で 19 論点レビュー+回帰テスト 31 件付き)
    - #4931: content.ts のみ手動統合(Phase 1 の isComposed ガードと同一ハンク)。サロゲート境界スナップは **!isComposed 時のみ実行**に変更(変換中の DOM 選択操作は IME アンカーを壊すため)
    - #4913: muya 側のみ適用(muyajs 側ハンクは削除済みエンジン向けで不要)
    - #4911: スキップ — 新エンジンには同等ガード実装済みと確認(codeBlockLanguageSelector #4654)
    - #4930(CodeMirror/Vue proxy)適用
13. ~~ripgrep ほか小修正~~ **完了**(2026-07-29)— setEncoding('utf8') 2 箇所、getPositionFromColumn 境界チェック、Save As/リネームのウォッチャー抑止(window-change-file-path に集約)、_ignoreChangeEvents の期限切れ掃除(60s 猶予で GH#3044 維持)、Untitled-NaN 修正。keybindings ダイアログは input readonly 化で IME 問題を根治(FIXME 解消)
14. ~~サイズ最適化の再適用~~ **完了**(2026-07-29)— 37 deps 移動(muyajs は削除済み)+ excludes 2 行。main の外部 require 18 種を静的検証(ajv/ajv-formats は electron-store 経由の production クロージャ内と確認)。build:unpack 成功

---

## 開発環境メモ(この調査環境)

- レジストリ: `https://npm.flatt.tech/`(CLAUDE.md 参照)。`pnpm install --registry https://npm.flatt.tech/`
- **GUI あり**: `DISPLAY=:10.0` の X サーバが利用可能。xvfb 不要
- 起動確認は Playwright `_electron` で可能。ワンショットスクリプト例はこのセッションの scratchpad `launch-check.mjs`(要点: `executablePath: packages/desktop/node_modules/.bin/electron`, `args: ['--no-sandbox', <appDir>]`, playwright-core は repo ルート node_modules に hoist 済み)
- `postinstall` の electron-rebuild は **pkg-config / X11 ヘッダ不足で失敗する**(native-keymap)が、prebuilt バイナリで動作するため実害なし。直すなら `apt-get install pkg-config libx11-dev libxkbfile-dev`
- ユニットテスト: `pdf.spec.ts` の 2 件がフルスイートでのみ失敗する既存 flake(変更の検証時は単独実行で切り分けること)

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
- ~~初回起動時の OS 言語自動検出も `ja` 対応~~ → **実は常に en に化ける既存バグだった**(2026-07-30 発見・修正): Preference 構築は app-ready 前で `app.getLocale()` が空文字を返し、空の primary タグが `startsWith('')` で必ずリスト先頭の en にマッチしていた。修正: 空ロケールガード + ready 後の `_initializeLanguage` が初回起動時に再検出。あわせて**フォークのデフォルト言語を ja に**(static/preference.json)。検出成功時は OS 言語優先、失敗時 ja。初回起動が ja に解決した場合は `spellcheckerNoUnderline: true` を既定に(Chromium に日本語辞書がなく、en-US チェッカーの日本語文への下線はノイズのため。チェッカー自体は既定 OFF のまま、右クリック提案は有効)。設定画面に「対象は英語のみ」の注記追加。実機起動で ja UI + 設定値をスクリーンショット確認済み
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

**新規発見(upstream に issue なし)— muya エンジン:**(5 件すべて修正済み 2026-07-29)

- ~~`langInputContent` の isComposed ガード欠落~~ → Phase 1 で修正
- ~~フロートメニューの composition キー横取り~~ → Phase 1 で修正(+BaseFloat Escape も)
- ~~`clipboard` — 複数ブロック選択中の IME keydown(keyCode 229)で `cutHandler()` 発火~~ → 修正: `shouldCrossBlockCut` に isComposing/keyCode 229 ガード追加
- ~~`editor` — compositionend が選択ゲートで drop → `isComposed` 固着で入力不能~~ → 修正: compositionstart したブロックを記録し、compositionend はゲートを迂回して必ずそのブロックへ配送。あわせて Format/codeBlockContent の `inputHandler` に null カーソルガード追加(選択消失時のクラッシュを回避、次の入力で自己回復)
- ~~`tableCell` の ZWSP ハック全エンジン無条件実行~~ → 修正: `isSafari` でゲート(Chromium では compositionstart 中の DOM 書き換えが IME アンカーを破壊し、compositionend の補償 strip が確定文字を 1 文字食っていた)

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
- ~~ユニットテストの `pdf.spec.ts` フルスイート限定 flake~~ → **根治**(2026-07-29): 原因は状態リークではなく、`vi.resetModules()` + テスト毎の動的 import が @muyajs/core の全グラフを毎回再変換し、負荷下で 5 秒の test timeout を超過していたこと。pdf.ts は `window.*` を呼び出し時に読み、module 状態も持たないため、トップレベル await の単一 import に変更(全 16 件が高負荷下でも通過、フルスイート 754/754)

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

## 残存課題バックログ(2026-07-30 全 issue/PR 再調査)

issues/ スナップショット全 563 件を再調査した結果。今回対応済み(下記「今回の対応」)を除く。

### 今回の対応(2026-07-30)

- PR 取り込み: #4952(テーブル列幅 min-width 10em→2em)、#4773(リンクの URIError クラッシュ)、#4873(Shift+数字キーバインド、patch-package)、#4776(順序リストマーカー保持 = #4772 の文書改変修正)、#4788(UNC/WSL パスの file:// URL、= #4577/#4563)、#4910(サイドバーアイコンの拡張子優先)、#4317(復元ウィンドウの作業領域クランプ)
- **`cloneStateTree` の配列 meta エイリアシングバグ発見・修正**(#4776 のテストが炙り出した実バグ。`sourceMarkers`/`aligns` がクローンと実 state で共有され、getState() の戻りの変更が文書を破壊)+ **反復化で #4747(600 段ネストの stack overflow)も解消**(10k 段の回帰テスト付き)
- #5028(Undo で全文消失)は**新エンジンでは再現せず**(0.19.1 レガシー限定)— 契約固定テスト `undoFloor.spec.ts` を追加
- フォルダ内検索のキーストローク毎 ripgrep 起動(#3556)をデバウンス(300ms、Enter 即時、IME ガード付き)

### 今回の対応(2026-07-30 第 2 ラウンド:起動バンドル分割 + 印刷経路の後始末)

- **起動バンドル分割**(#2300 の続き)— レンダラー主チャンク 5444KB→**4306KB**(-21%)、初期 CSS 311KB→227KB、起動→編集可能表示の中央値 2684ms→**2472ms**(同一マシン 7 回の中央値。環境ノイズ大、最小値は 2336→2313ms)
  - `sourceCode.vue`(CodeMirror 約 590KB)をソースモード突入時ロードに
  - file-icons のルール DB + CSS(約 270KB)をツリー初回行の描画時ロードに。**CommonJS のため dynamic import だけでは Rollup が呼び出し元チャンクへ戻す** → `manualChunks` で明示的に分離が必須
  - about / コマンドパレット / エクスポート設定 / リネーム / インポートの 5 ダイアログを初回オープン時ロードに
  - 未使用の axios(`$http` グローバル)を削除
  - 遅延化で静かに壊れる箇所(アイコンクラスと、それをグリフにする CSS の両方が届くこと)を e2e で固定
- **PDF/印刷の失敗経路で印刷用 DOM コピーが残るリーク修正** — printToPDF の例外・書き込み失敗・`print()` の例外/失敗コールバックで `mt::print-service-clearup` が飛ばず、文書 1 部ぶんの DOM(画像・図込み)がセッション終了まで残っていた。`finally` と try/catch で全経路をカバー、印刷失敗は理由付きでログ
  - 調査メモ: `article.print-container` は画面上では `display: none`(印刷メディアでのみ反転して唯一の表示要素になる)。**したがってこれは「UI が印刷ビューに覆われてフリーズ」ではなくメモリリーク**。#3880 の本体(フリーズ)は下記のとおり未対応

### 今回の対応(2026-07-30 第 3 ラウンド:キーストローク毎の処理削減 + 検索バーの競合修正)

計測は 98KB / 1500 行の文書に対する連続入力、CDP サンプリングプロファイラ(scratchpad `typing-profile.cjs`)。**キーストローク往復の中央値 160ms → 81ms**、レンダラーの idle 17% → 37%。

- **`blocks: getState()` の削除**(デスクトップ)— content-change ペイロードが毎打鍵でブロックツリー全体をクローンしていたが、誰も読んでいなかった(store が `tab.blocks` に代入し `sourceCode.vue` が消すだけ)。ペイロード・store・`IFileState`・`file-changed` emit から除去
- **`deep-equal` → 専用比較関数**(デスクトップ)— TOC の差分判定が入力中 CPU の約 39%。TOC エントリは `{level, content, slug}` のフラットなレコードなので要素毎の浅い比較で等価。依存パッケージごと削除
- **content ハッシュを cyrb64 化**(デスクトップ `syntheticHistory`)— BigInt FNV-1a が約 6%。文字毎の BigInt 乗算をやめ `Math.imul` 2 レーンへ。末尾改行の除去も文字列コピーではなく終端インデックスの走査に
- **不要な deepClone の除去**(デスクトップ)— `SEARCH` のマッチ集合、画像自動パス・リネーム IPC が現在ファイル丸ごとのクローンを main に送っていた(main は数フィールドしか見ない)
- **muya `LinkedList.offset()` の配列化を廃止** — 全ブロックの `path` ゲッター経由で毎ミューテーション呼ばれる。`next` チェーン走査に。`find()` も同様、`map()` の `[...acc, x]` fold(要素毎に累積配列をコピー = 二次オーダー)も解消
- **muya `getMarkdown()` の防御的クローン削除** — `StateToMarkdown` は state を読むだけ(調整する `meta` は自前で deepClone)
- **muya `wordCount()` の単一パス化** — 全文に対し 3 回の文字列変換(CJK 正規表現除去 → `/\s+/` split → reduce)を毎打鍵実行していた。コードポイント 1 パスに書き換え(プロファイル比 2.0% → 1.2%)。**カウントはユーザーに見える値なので、旧実装をテスト内に埋め込んだ差分テストで固定**(区切り連続・CRLF・特殊空白・サロゲートペア・CJK 混在の 24 ケース + シード固定 PRNG の 500 文書)
- **検索バーの実バグ修正** — 入力は検索を 150ms デバウンスでスケジュールするだけなので、その窓の内側で Enter を押すと**前のクエリのマッチ集合**を送り、直後に着弾したデバウンス検索がハイライトを 1 件目に戻していた。ステップ前に `debouncedSearchFn.flush()`
- **エンジン undo 履歴のスナップショットを打鍵毎 → タブ切替時に変更**(デスクトップ)— `json-change` が毎回 `editor.getHistory()`(undo+redo スタック最大 100 件を deep clone)を呼んでいた。ソースモードを一度出ると**文書全体を含む `rebuild` op** がスタックに載るため、以降は 1 文字毎に文書全体を再クローンしていた。読み出しはタブ切替時のみなので、エンジンが保持しているタブ id を追跡し `setContent` の直前に退避する方式へ。プロファイルから `structuredClone` が消滅
  - 注意点: **最初の文書は Muya コンストラクタのオプション経由で読み込まれる**ため `file-loaded` も `file-changed` も走らない。マウント時に id を種付けしないと 1 つ目のタブの undo 履歴が切替時に失われる(e2e `tab-switch-cursor.spec.ts` が検出)
- 残りのホットスポット(JS 側): `hashContent` 1.4%、`wordCount` 1.3%、`tocEquals` 0.8%、直列化系(`_serializeTable` / `stringWidth` / `_serializeTextParagraph`)合計約 1.5%。**JS は既に全体の 2 割程度で、残りはネイティブ側**

#### ネイティブ側(Chromium)の調査 — 打鍵コストの主因はレイアウト/描画

同一ハーネスで文書サイズだけを変えた比較(scratchpad `typing-profile.cjs` / `layout-probe.cjs` / `reflow-count.cjs`):

| 文書 | 打鍵往復 中央値 | `(program)`(ネイティブ) | 1 段落変更後の強制レイアウト |
|---|---|---|---|
| 3KB / 40 行 | 41ms | 17.1%(≒9ms/打鍵) | 0.4ms |
| 98KB / 1500 行 | 80ms | 42.8%(≒39ms/打鍵) | 10.1ms |

- **JS からの強制レイアウトは 1 打鍵あたり 1 回・0.01ms**(`Range.getClientRects` を計装して計測)。つまり JS がレイアウトを叩いているわけではなく、フレーム内の style/layout/paint そのものが文書サイズに比例している
- `content-visibility: auto` + `contain-intrinsic-size` をトップレベルブロックに注入して A/B: **中央値は 80ms → 78ms でほぼ不変**、ただし p25 は 79ms → 58ms、最小は 59ms → 39ms と下振れ側だけ改善。効果が不安定な一方で、印刷 CSS・検索のスクロール追従・スクロールアンカリングへの影響が読めないため**今回は採用しない**(再挑戦するならまず印刷/検索の e2e を固めてから)

### 今回の対応(2026-07-30 第 4 ラウンド:文書入れ替えのメモリリーク + 保存確認の取りこぼし)

#### メモリリーク — タブを開いて閉じるたびに文書 1 部ぶんの DOM が残っていた

計測は scratchpad `leak-shape.cjs`(1 ラウンド = ファイルを開く → タブを閉じる、毎ラウンド `HeapProfiler.collectGarbage` 後に `Performance.getMetrics`)。**1 ラウンドあたり Nodes 約 +33,700・JSEventListeners 約 +567 が積み上がり、生きている DOM のノード数は横ばい**だった = 切り離された(detached)ツリーが解放されていない。

原因はヒープスナップショットの保持経路を BFS で辿って特定(`heap-snap.cjs` + `heap-retainers.cjs`):

```
Muya → .eventCenter → .events[] → 登録オブジェクト → .target <i class="mu-copy-header-link">
     → __MUYA_BLOCK__ → HeadingCopyLink → .parent AtxHeading → .next … → ブロックツリー全体 + domNode
```

`EventCenter.attachDOMEvent` は `{eventId, target, event, listener, capture}` を **Muya インスタンスの生存期間ずっと**保持する。見出しのコピーリンク(1 見出しにつき click/keydown の 2 件)とタスクリストのチェックボックス(1 件)はブロック単位の要素なのにここへ登録されていた。文書入れ替え(`ScrollPage.updateState` → `empty()`)は `children` だけを辿って `removeChild` するので **`attachments` は誰も `remove()` を呼ばない** → 登録が残り、`target` 要素と、その `__MUYA_BLOCK__` 逆参照からブロックツリー丸ごとが GC されない。

- 修正: ブロック単位のリスナーは `domNode.addEventListener` で**自分のノードに直接**バインド(ノードと一緒に死ぬ)。`eventCenter` は document / body / エディタルートのような長寿命ターゲット専用にし、その旨を `attachDOMEvent` の doc コメントに明記
- 結果(4 ラウンド): Nodes 15,776 → 15,784(横ばい)、JSEventListeners 562 で一定、ヒープ 13.7MB(修正前は 6 ラウンドで 25.1MB)

#### 保存確認の取りこぼし(データ損失級)3 件

- **リネーム / 「移動」がタブを「保存済み」にしていた** — `mt::set-pathname` を保存(内容を書き出す)とリネーム・移動(ファイルを動かすだけ)の両方が使い回していた。未保存の編集があるタブをリネームすると `isSaved: true` になり、**閉じるときの確認ダイアログが出ないまま編集が消える**。ペイロードに `contentSaved: boolean` を追加して両者を区別
- **書き込み中の打鍵が消える** — 保存 ack (`mt::tab-saved`) はタブ id しか運ばないため「今の内容は全部ディスクにある」と解釈していた。書き込み中に打った 1 文字はその ack の対象ではない。送信時点の履歴エントリ id をタブ毎の FIFO に積み、ack でそれを取り出して**現在の履歴位置と一致するときだけ** clean にする方式へ(書き込み失敗時はキューから取り除いて次のリトライとずれないように)
- **自動保存がスケジュール時点のパスと内容を送っていた** — タイマー発火までにサイドバーからリネームすると、**旧パスのファイルが古い内容で復活し、リネーム後のファイルは更新されない**。タイマー本体で発火時にタブの現在値を読むよう変更
- 回帰テスト `test/unit/specs/save-ack.spec.ts` 6 件(リネーム / パス選択を伴う保存 / 書き込み中の編集 / 通常保存 / 失敗後のリトライ / 自動保存中のリネーム)

#### レンダラーのライフサイクル修正

- **`editor.vue` の paddingBottom リセットが別の要素を触っていた** — `.mu-container` 側(エンジンが文書間で使い回すノード)の 100vh 末尾パディングを恒久的に潰していた。リセット対象を実際に付けた `firstChild` に修正
- **サイドバーのリスナー解放漏れ** — `tree.vue` の document 直付け 3 種(click / contextmenu / keydown)と `bus` 購読、`treeFolder.vue` / `treeFile.vue` の `bus` 購読に `onBeforeUnmount` を追加
- **`search.vue` の競合** — 前の検索が返ってくると、キャンセル済みでも結果と実行中フラグを上書きしていた。実行 id を発行して古い応答を捨てるように。アンマウント時のデバウンス・検索キャンセル・タイマー停止も追加

### 今回の対応(2026-07-30 第 5 ラウンド:PDF エクスポートの非表示ウィンドウ化 + 小修正)

- **#3880 — PDF エクスポートを非表示ウィンドウへ移設**。renderer は書き出し HTML を `mt::response-export` の `content` に載せて送るだけになり、印刷用 DOM コピー(printService)は PDF 経路から消滅。main は一時 HTML ファイル → `javascript: false` の隠し BrowserWindow → `loadFile`(did-finish-load で解決)→ `printToPDF` → `finally` で破棄 + 一時ファイル削除
  - printService.css のうち**内容を整形する側**のルール(`padding: 0`、checkbox 隣接 p、fenced code の折返し、図の中央寄せ / max-width、`@page background`)を `hiddenWindowPrintCss`(util/pdf.ts)として書き出し HTML に同梱。ページ余白は元々ダイアログ設定由来の `@page` が extraCss に入っているため追加不要だった
  - **ページ送りのパリティ検証**(懸念だった printService.css 非同梱による改ページ変化): 8 ページのフィクスチャで新旧 PDF を比較 — **ページ数 8/8 一致**、159,177 → 158,033 bytes、pdftoppm レンダリングの目視で全ページの改ページ位置・内容一致(表の列幅にごく僅かな差のみ)
  - **フリーズ実測**(459KB / 約 6,000 ブロック): エクスポート中のレンダラー最大停止 **2,318ms → 376ms**(残余は exportStyledHTML の HTML 生成そのもの)、エクスポート全体 4.8s → 3.0s
  - e2e 更新: PDF 経路で `.print-container` が一切マウントされないこと、隠しウィンドウが後始末されること、`loadFile` 失敗時にウィンドウ・ファイル・成功通知のどれも残らないこと(`BrowserWindow.prototype.loadFile` スタブで失敗注入)を固定
  - 物理印刷経路は従来どおり可視ウィンドウ + printService.css(スコープ外のまま)
- **検索バーを開くと書式ツールバーが上に残る問題を修正** — テキスト選択中に Ctrl+F を押すと muya のインラインフォーマットツールバーが検索バーに重なり置換トグルのクリックを奪っていた。`find` / `replace` バスイベントで `hideAllFloatTools()`(前セッションの仕掛かりを完成)。e2e は実マウスドラッグ → Find → フロート退避を検証し、修正を外すと失敗することを確認済み
- (前セッション分の記録)レンダラーの esbuild minify 化(`f0bc95a9`)— 起動チャンク 3.3MB → 1.85MB。起動時間・常駐メモリは不変で、フットプリント削減のみと計測済み

### 今回の対応(2026-07-30 第 6 ラウンド:クラッシュ再現 + PR #4862 取り込み + 小物 2 件)

- **#4995(画像リサイズの null クラッシュ)— 現行エンジンでも同型を再現・修正**。リサイズバーの描画は setTimeout 越し、ドラッグ用リスナーは document.body 直付けなので、その隙間に dismissal(ツールバーからの画像削除・編集ダイアログ・文書入れ替え)が割り込むと、(a) 遅延描画が null 参照を触り **報告と同一の `Cannot read properties of null (reading 'getBoundingClientRect')`**、(b) throw で後始末が飛び孤児のリサイズハンドルが画面に残留、(c) ドラッグリスナーが external にバーの消えた後も発火し続けた。描画の null ガード + 「バーを消す全経路がドラッグも終了させる」不変条件 + mousemove/update の防御で修正。回帰テスト 3 件は旧実装で全滅(1 件目が同一メッセージ)を確認済み
  - テスト補足: happy-dom の MouseEvent には `x` エイリアスがなく muya の `isMouseEvent`(`'x' in event`)で弾かれる — 合成イベントに `x` を defineProperty するヘルパーが必要
- **#4958(watcher バー直後のクラッシュ)— レガシー限定と判定**。スタックの `StateRender.partialRender` / `cursorOutMostBlock` は旧 muyajs エンジンの内部で、削除済みのため現行コードに存在しない。新実装では変更検知バーは非モーダルのタブ内通知、リロードは確認後の全文書 `setContent` 経路のみで、部分再描画は存在しない。「変更していないのにバーが出た」件も byte 同一なら警告しない #1861 ガードが対応済み
- **PR #4862 取り込み**(インライン書式ツールバーのキーバインド同期 + ネイティブ richtext 抑止)— editor.vue の import 順競合 1 箇所を除きクリーン適用。muya に `inlineFormatShortcuts` オプション(ツールチップ label + 内部ハンドラの key matcher、`setOptions` で即時反映)、desktop は `mt::keybindings-response` から起動時と保存毎に流し込み。`format*` beforeinput の全キャンセルで Chromium ネイティブ書式編集(モデル外の DOM 直変更)も遮断。**実機検証**: Linux でインラインコードのツールチップが実バインディング `Ctrl+Y`(ハードコード時代は Ctrl+\`)+ ja ロケール文言で表示されること、muya e2e shortcuts 6/6 を確認
- **#3685 — フォルダ検索の 100 ファイル上限を `searchResultLimit` 設定に**(internal、既定 100、最小 1)。打ち切りメッセージも設定値を表示
- **#4322 残り — 初回起動の UI 言語検出を強化**。`app.getPreferredSystemLanguages()` → `getLocale()` → POSIX ロケール環境変数(LC_ALL/LC_MESSAGES/LANG、app-ready 前でも有効)の順で候補を舐める共通マッチャに、二重実装だった検出 2 経路(Preference コンストラクタ / App init)を統一。**App 側の私製マップが出荷していない 'ru' を返し得た**(ロシア語環境で UI が生キー表示になる実バグ)、zh-HK 以外の繁体字タグが zh-CN に落ちる問題も同時に解消。実機検証: `LC_ALL=fr_FR.UTF-8` + 新規プロファイルで仏語 UI 起動
- 検証: desktop 813 / muya 1,586 / 新規スペック 3 本、typecheck・lint・build:unpack すべて通過

### 新規調査で発見した課題(2026-08-14)

コードベース全体の監査(テーマ/コントラスト系 + レンダラー/メインのロジック系)で確認した実バグ。**根本原因パターン: アプリ側の CSS 変数は整っているが、Element Plus の `--el-*` トークンを一度もグローバルに再マップしていなかった**ため、EP2 の白/グレー既定がダークテーマ各所に残っていた(スイッチつまみ修正 `f0494419` と同族)。

#### テーマ/コントラスト — 対応済み(`20a5a4fc`)

`--el-*` を `body` 上で MarkText 変数へ一括マップ(EP コンポーネント CSS が `:root` を上書きしても勝つ)。加えて:

1. ~~設定画面のラジオボタン~~ 未選択ラベルも `--editorColor`
2. ~~入力欄の白ラッパー~~ `.el-input__wrapper` / `.el-select__wrapper` をテーマ化
3. ~~フォント選択ボックス~~ ラッパー + 二次テキストをトークン化(EP1 popper セレクタは dead のまま、オーバーレイはグローバルマップでカバー)
4. ~~画像アップローダー~~ 存在しない `--editorColor70`/`--editorColor20` を `--editorColor50`/`--editorColor10` へ
5. ~~one-dark のタスクチェックマーク~~ 塗り `--themeColor`、チェック `--editorBgColor`(muya 既定に合わせる)
6. ~~セレクトのキーボードハイライト~~ `.is-hovering` を追加
7. ~~テーブル挿入ダイアログ~~ ラベルを `--editorColor`
8. ~~タイトルバー制御アイコン~~ `fill: var(--iconColor)`

回帰: `test/unit/specs/el-theme-tokens.spec.ts`

#### ロジック

1. ~~閉じたフォルダの watcher イベントが `pendingTreeEvents` に溜まり続ける~~ **対応済み**(`b841373c`)— unlink はキューしない + CLOSE 時に purge
2. ~~保存/画像挿入/タイトルが先頭ルート固定~~ **対応済み**(`939762cd`)— `findTreeForPath` で所有ルートを解決
3. ~~Close All / Close Others が保存ダイアログを多重表示~~ **対応済み**(`939762cd`)— `closeTabsWithSavePrompt` でバッチ化。CLOSE_TABS の隣タブ選択も修正
4. ~~サイドバーのリネーム失敗がサイレント~~ **対応済み**(レンダラー `b841373c`、main `6e998c95`)
5. ~~`document.title` watcher の取りこぼし~~ **対応済み**(`10c14ba2`)— `immediate` + project 監視
6. ~~パス比較が `===`~~ **対応済み**(`b841373c` / `939762cd`)— `isSamePathSync`
7. ~~フォルダ内検索のエラーが「結果なし」に見える~~ **対応済み**(`6e998c95`)
8. **コマンドパレットの Find Next/Previous がコメントアウトのまま** — `commands/index.ts:211-226`。メニュー(F3)経路は同じ bus イベントで動作しているため再有効化できる可能性が高い(要動作確認)。**未対応**
9. ~~i18n 抜け~~ **対応済み**(`10c14ba2`)

### 高優先(バグ)

1. **#4989/#5012/#4943** — テーブル編集で ot-json1 の状態破壊。**2026-07-30 再現試行**: 構造操作(行/列の挿入・削除の全オフセット + 交互操作 + 全消し)を flush 付きで総当たりする `structuralOpsFuzz.spec.ts` を追加したが再現せず。ペースト/undo 絡みか、実トレース(ユーザーの再現 md)待ち。fuzz スイートは回帰網として常設
2. **#4962** — 連続空行の 1 行への正規化(実測: `a\n\n\n\nb` → `a\n\nb`。単一空行は保持され、0.19.1 の「全部密着」は非再現)。保持には全ブロック種に `blankLinesBefore` 系 meta を通すエンジン級変更 + 編集時の意味論設計が必要(#4776 の sourceMarkers 方式の全面展開)。**#4934 の roundTrip 3 件 baseline failure は解消済みを確認**(15/15 通過、Tables は verbatim 同一)
3. ~~#4789~~ **取り込み済み**(2026-07-30)— watcher 部分のみ(画像部分は #4788 と同一)。加えて UNC ファイルポーリング経路に自己書き込み抑止(`_shouldIgnoreEvent`)を追加(原 PR の抜け)
4. **#4973** — 巨大テーブル + Windows UIA クライアントで main プロセスがハング(Chromium AX ツリー起因)。Electron 層の対処が必要
5. ~~#4958 / #4995~~ **対応済み**(2026-07-30 第 6 ラウンド)— #4995 は現行エンジンで同型を再現し修正、#4958 はレガシー限定と判定(記録は上記ラウンド参照)

### 中優先(取り込み候補 PR、レビュー待ち)

- ~~#4862~~ **取り込み済み**(2026-07-30 第 6 ラウンド)— 実機検証込み(上記ラウンド記録参照)
- ~~#4645~~ **取り込み済み**(2026-07-30)— 実測: レンダラー主チャンク 6.94MB→5.44MB(-21%)、起動→エディタ表示の中央値 2245ms→2078ms(-167ms)。el-tree/タブ/ダイアログ系 e2e 通過
- #4935/#5004(数式まわり、直列化の #4934 と要整合)、#4908(ソースモード行番号設定)、#4318(カスタムテーマ)、#4814(macOS 辞書)
- ~~#4322 の残価値~~ **対応済み**(2026-07-30 第 6 ラウンド)— getPreferredSystemLanguages + POSIX 環境変数フォールバック、検出 2 経路の統一(上記ラウンド記録参照)

### パフォーマンス(未対応)

- #3893/#1035 — 1 万ファイル級フォルダでツリー仮想化なし(開けない事例も)。大規模リファクタ
- ~~#3880~~ **対応済み**(2026-07-30 第 5 ラウンド)— PDF エクスポートを非表示ウィンドウ化。ページ送りパリティは新旧 PDF 比較で検証済み(上記ラウンド記録参照)
- #3368 — アニメ GIF の CPU 消費、#2300 — 起動 2-3 秒(#4645 が一部)、#3640 — 巨大ファイルでの書式適用ラグ(開くのは #4946 で解決済み)
- ~~#3685~~ **対応済み**(2026-07-30 第 6 ラウンド)— `searchResultLimit` 設定化

### スキップ確定

- #4972(レガシー muyajs 専用と PR 本文が明言)、#4246(レガシー)、#4146(現実装が既に優れる)、#4664/#4245(upstream リリース事務)
- 大型機能 PR(#4325 ツールバー、#4468 front-matter、#4804/#4834 RTL、#4832 GitHub 連携、#4070 読み取り専用モード=旧レイアウト)は必要になった時点で個別評価

## 開発環境メモ(この調査環境)

- レジストリ: `https://npm.flatt.tech/`(CLAUDE.md 参照)。`pnpm install --registry https://npm.flatt.tech/`
- **GUI あり**: `DISPLAY=:10.0` の X サーバが利用可能。xvfb 不要
- 起動確認は Playwright `_electron` で可能。ワンショットスクリプト例はこのセッションの scratchpad `launch-check.mjs`(要点: `executablePath: packages/desktop/node_modules/.bin/electron`, `args: ['--no-sandbox', <appDir>]`, playwright-core は repo ルート node_modules に hoist 済み)
- `postinstall` の electron-rebuild は **pkg-config / X11 ヘッダ不足で失敗する**(native-keymap)が、prebuilt バイナリで動作するため実害なし。直すなら `apt-get install pkg-config libx11-dev libxkbfile-dev`
- ユニットテスト: `pdf.spec.ts` の 2 件がフルスイートでのみ失敗する既存 flake(変更の検証時は単独実行で切り分けること)
- **e2e は `out/` のビルド済みコードを実行する**。ソース変更後にビルドせず走らせると原因不明の失敗になる。e2e 実行中に `build:unpack` を走らせるのも同じ理由で禁止
- `find-replace` の findPrev("2 / 3" が "3 / 3" になる)は**実バグの検出だった**(検索バーのデバウンス競合、第 3 ラウンドで修正済み)。非フォーカスのウィンドウでは Chromium がタイマーを絞るため、デバウンスの trailing edge が約 1 秒遅れて着弾し、e2e でだけ顕在化していた。この種の失敗を「ビルドが古い」で片付けないこと
- `find-replace` の findPrev テストは**直前のテストの状態(1/3)から継続する**ため `-g` で単独実行すると "0 / 0" になる。describe ブロックごと走らせること
- `launchElectron([folder])` の位置引数フォルダは **`openFolderInNewWindow` により別ウィンドウで開く**ため `firstWindow()` には現れない。テスト対象ウィンドウでフォルダを開くには内部チャンネルを直接叩く: `ipcMain.emit('app-open-directory-by-id', win.id, folder, true)`(サイドバーの「フォルダを開く」と同じ経路。ネイティブダイアログのみ迂回)
- Playwright は `pnpm exec playwright test test/e2e` とパスを明示する(パス無しだと `test/unit` も収集して失敗)

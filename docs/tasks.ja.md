# md-hinagata タスク一覧

> Target: `0.x.x` development  
> Initial milestone: `0.1.0` MVP  
> Related documents: `docs/requirements.ja.md`, `docs/design.ja.md`

このドキュメントは、md-hinagata の開発タスクを GitHub Issue や Project に移しやすい粒度で整理したものです。

`0.1.0` は完成版ではなく、以下の体験を最短で成立させる MVP として扱います。

```txt
Markdown を VS Code で編集する
frontmatter で theme を指定する
Rust/WASM core で theme template を適用する
右側 Preview で確認する
左側 Theme Manager で theme と template を確認する
生成 HTML をコピーする
```

---

## 1. 優先度ルール

| 優先度 | 意味 |
|---|---|
| P0 | `0.1.0` MVP に必須。これがないとプロダクトの核が成立しない |
| P1 | `0.1.0` に入れたい。削っても MVP は成立するが体験が弱くなる |
| P2 | `0.1.x` または `0.2.0` 以降で対応する |
| P3 | 将来構想。現時点では backlog 扱い |

---

## 2. Milestone 方針

| Milestone | 目的 |
|---|---|
| `0.1.0` | 思想が体験できる縦切り MVP |
| `0.1.x` | MVP の安定化、バグ修正、小改善 |
| `0.2.0` | Theme Manager、validation、workspace theme、diagnostics の強化 |
| `0.3.0` | CLI、CI、theme package、syntax highlight などの拡張 |
| `1.0.0` | theme schema、frontmatter schema、template variables、CLI interface の安定化 |

---

## 3. `0.1.0` 完了条件

`0.1.0` は、以下を満たした時点でリリース可能とします。

- [ ] VS Code で Markdown ファイルを開ける。
- [ ] frontmatter の `hinagata.theme` を読める。
- [ ] frontmatter がない場合に `default` theme を使える。
- [ ] workspace theme を `.md-hinagata/themes/{themeId}` から読み込める。
- [ ] bundled `default` theme を読み込める。
- [ ] Rust/WASM core で Markdown を HTML fragment に変換できる。
- [ ] `h1`, `h2`, `h3`, `p`, `codeblock` を template で変換できる。
- [ ] 可能なら `blockquote`, `ul`, `ol`, `li` も template で変換できる。
- [ ] 右側 Webview Preview に変換結果を表示できる。
- [ ] Markdown 編集時に Preview が更新される。
- [ ] template 保存時に Preview が更新される。
- [ ] 左側 Theme Manager に現在 theme と template 一覧が表示される。
- [ ] template 一覧から `.hbs` ファイルを VS Code 標準エディタで開ける。
- [ ] `Copy Generated HTML` で HTML fragment をクリップボードにコピーできる。
- [ ] Unknown theme の warning を出せる。
- [ ] Missing template の warning を出せる。
- [ ] README と docs の手順通りにローカル実行できる。

---

## 4. `0.1.0` タスク一覧

### 4.1 Project setup

#### MS-001: monorepo skeleton を作成する

- Milestone: `0.1.0`
- Priority: P0
- Type: setup

作成する構成:

```txt
md-hinagata/
  package.json
  pnpm-workspace.yaml
  Cargo.toml
  README.md
  README.ja.md
  apps/
    vscode-extension/
  crates/
    md-hinagata-core/
    md-hinagata-wasm/
  themes/
    default/
  examples/
    basic/
  docs/
```

Acceptance criteria:

- [ ] `pnpm install` が通る。
- [ ] `cargo check --workspace` が通る。
- [ ] VS Code extension project と Rust workspace が同じ repo に存在する。
- [ ] README に開発セットアップ手順がある。

---

#### MS-002: root scripts を整備する

- Milestone: `0.1.0`
- Priority: P0
- Type: setup
- Depends on: MS-001

想定 scripts:

```json
{
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "build:wasm": "node scripts/build-wasm.mjs",
    "package:extension": "pnpm --filter vscode-extension package"
  }
}
```

Acceptance criteria:

- [ ] root から extension build を実行できる。
- [ ] root から wasm build を実行できる。
- [ ] root から最低限の test または check を実行できる。

---

#### MS-003: 開発用 VS Code 設定を追加する

- Milestone: `0.1.0`
- Priority: P1
- Type: setup
- Depends on: MS-001

追加候補:

```txt
.vscode/
  extensions.json
  settings.json
  launch.json
  tasks.json
```

Acceptance criteria:

- [ ] Extension Development Host を起動できる。
- [ ] Rust と TypeScript の基本的な開発拡張が推奨される。
- [ ] build task が VS Code から実行できる。

---

### 4.2 Theme fixtures

#### MS-010: bundled default theme を作成する

- Milestone: `0.1.0`
- Priority: P0
- Type: theme
- Depends on: MS-001

作成する theme:

```txt
themes/default/
  theme.json
  styles.css
  templates/
    h1.hbs
    h2.hbs
    h3.hbs
    p.hbs
    codeblock.hbs
    blockquote.hbs
    ul.hbs
    ol.hbs
    li.hbs
```

Acceptance criteria:

- [ ] `theme.json` に `id`, `name`, `version`, `entryCss`, `templates` がある。
- [ ] `h1`, `h2`, `h3`, `p`, `codeblock` の template が存在する。
- [ ] `blockquote`, `ul`, `ol`, `li` の template が存在する。
- [ ] `styles.css` が Preview に適用できる内容になっている。

---

#### MS-011: example Markdown を作成する

- Milestone: `0.1.0`
- Priority: P0
- Type: fixture
- Depends on: MS-010

作成する file:

```txt
examples/basic/article.md
examples/basic/expected.html
```

`article.md` 例:

````md
---
hinagata:
  theme: default
  output: fragment
---

# Title

本文です。

## Section

さらに本文です。

```ts
const message = "hello";
```
````

Acceptance criteria:

- [ ] frontmatter に `hinagata.theme` がある。
- [ ] `h1`, `h2`, `p`, `codeblock` の変換を確認できる。
- [ ] `expected.html` が snapshot test の基準として使える。

---

#### MS-012: theme schema draft を作成する

- Milestone: `0.1.0`
- Priority: P1
- Type: schema
- Depends on: MS-010

作成する file:

```txt
schemas/theme.schema.json
```

Acceptance criteria:

- [ ] `theme.json` の必須 field を検証できる。
- [ ] `templates` が object であることを検証できる。
- [ ] `entryCss` が string であることを検証できる。
- [ ] 0.1.0 時点の schema として README から参照できる。

---

### 4.3 VS Code extension skeleton

#### MS-020: VS Code extension skeleton を作成する

- Milestone: `0.1.0`
- Priority: P0
- Type: extension
- Depends on: MS-001

作成する基本構成:

```txt
apps/vscode-extension/
  package.json
  tsconfig.json
  esbuild.config.ts
  src/
    extension.ts
```

Acceptance criteria:

- [ ] Extension Development Host で拡張が起動する。
- [ ] `activate` と `deactivate` が実装されている。
- [ ] package できる状態になっている。

---

#### MS-021: Commands を登録する

- Milestone: `0.1.0`
- Priority: P0
- Type: extension
- Depends on: MS-020

登録する commands:

```txt
md-hinagata.openPreview
md-hinagata.copyGeneratedHtml
md-hinagata.selectTheme
```

表示名:

```txt
md-hinagata: Open Preview
md-hinagata: Copy Generated HTML
md-hinagata: Select Theme
```

Acceptance criteria:

- [ ] Command Palette から各 command を実行できる。
- [ ] Markdown file 以外で実行した場合に分かりやすい message を出せる。
- [ ] command handler が個別 file に分割されている。

---

#### MS-022: Preview Panel の skeleton を作成する

- Milestone: `0.1.0`
- Priority: P0
- Type: extension
- Depends on: MS-021

作成する file:

```txt
apps/vscode-extension/src/panels/previewPanel.ts
apps/vscode-extension/media/preview/main.ts
apps/vscode-extension/media/preview/styles.css
```

Acceptance criteria:

- [ ] `Open Preview` で右側に Webview Panel が開く。
- [ ] placeholder HTML を表示できる。
- [ ] Webview に CSS を適用できる。
- [ ] Panel を再利用できる。重複して複数開かない。

---

#### MS-023: Theme Manager View の skeleton を作成する

- Milestone: `0.1.0`
- Priority: P0
- Type: extension
- Depends on: MS-020

作成する file:

```txt
apps/vscode-extension/src/views/themeEditorViewProvider.ts
apps/vscode-extension/media/theme-editor/main.ts
apps/vscode-extension/media/theme-editor/styles.css
```

package contribution:

```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "md-hinagata",
          "title": "md-hinagata",
          "icon": "resources/md-hinagata.svg"
        }
      ]
    },
    "views": {
      "md-hinagata": [
        {
          "id": "md-hinagata.themeManager",
          "name": "Theme Manager",
          "type": "webview"
        }
      ]
    }
  }
}
```

Acceptance criteria:

- [ ] Activity Bar に md-hinagata icon が表示される。
- [ ] 左サイドバーに Theme Manager が表示される。
- [ ] placeholder UI を表示できる。
- [ ] extension から view に state を postMessage できる。

---

### 4.4 Rust core

#### MS-030: `md-hinagata-core` crate を作成する

- Milestone: `0.1.0`
- Priority: P0
- Type: rust
- Depends on: MS-001

作成する file:

```txt
crates/md-hinagata-core/
  Cargo.toml
  src/
    lib.rs
    transform.rs
    frontmatter.rs
    theme.rs
    template.rs
    renderer.rs
    diagnostics.rs
    error.rs
```

Acceptance criteria:

- [ ] `cargo check -p md-hinagata-core` が通る。
- [ ] `transform` module が public API を持つ。
- [ ] unit test を実行できる。

---

#### MS-031: TransformRequest / TransformResponse を定義する

- Milestone: `0.1.0`
- Priority: P0
- Type: rust
- Depends on: MS-030

想定型:

```rust
pub struct TransformRequest {
    pub markdown: String,
    pub themes: Vec<ThemePackage>,
    pub default_theme_id: Option<String>,
    pub options: TransformOptions,
}

pub struct TransformResponse {
    pub html: String,
    pub css: Option<String>,
    pub resolved_theme_id: String,
    pub diagnostics: Vec<Diagnostic>,
}
```

Acceptance criteria:

- [ ] `serde` で serialize / deserialize できる。
- [ ] VS Code 側から JSON 経由で扱いやすい field 名になっている。
- [ ] diagnostics を response に含められる。

---

#### MS-032: frontmatter parser を実装する

- Milestone: `0.1.0`
- Priority: P0
- Type: rust
- Depends on: MS-031

対応する構文:

```yaml
---
hinagata:
  theme: default
  output: fragment
---
```

Acceptance criteria:

- [ ] frontmatter がある場合に parse できる。
- [ ] frontmatter がない場合に本文全体を Markdown として扱える。
- [ ] `hinagata.theme` を取得できる。
- [ ] `hinagata.output` を取得できる。
- [ ] YAML が壊れている場合に diagnostic を返せる。

---

#### MS-033: ThemePackage model を実装する

- Milestone: `0.1.0`
- Priority: P0
- Type: rust
- Depends on: MS-031

想定型:

```rust
pub struct ThemePackage {
    pub id: String,
    pub name: String,
    pub version: String,
    pub css: Option<String>,
    pub templates: BTreeMap<String, String>,
}
```

Acceptance criteria:

- [ ] VS Code 側で読み込んだ theme files を Rust core に渡せる。
- [ ] theme id で対象 theme を選択できる。
- [ ] theme が見つからない場合に default theme へ fallback できる。
- [ ] fallback した場合に diagnostic を返せる。

---

#### MS-034: Handlebars template rendering を実装する

- Milestone: `0.1.0`
- Priority: P0
- Type: rust
- Depends on: MS-033

Acceptance criteria:

- [ ] template string を render できる。
- [ ] `{{text}}` を HTML escaped text として扱える。
- [ ] `{{{inner_html}}}` を HTML として挿入できる。
- [ ] render error を diagnostic として返せる。
- [ ] unknown variable の検出は 0.1.0 では warning 対応または future task として扱える。

---

#### MS-035: Markdown parser と basic renderer を実装する

- Milestone: `0.1.0`
- Priority: P0
- Type: rust
- Depends on: MS-034

対象要素:

```txt
h1
h2
h3
p
codeblock
```

Acceptance criteria:

- [ ] `# Title` を `h1.hbs` で render できる。
- [ ] `## Section` を `h2.hbs` で render できる。
- [ ] `### Section` を `h3.hbs` で render できる。
- [ ] paragraph を `p.hbs` で render できる。
- [ ] fenced code block を `codeblock.hbs` で render できる。
- [ ] missing template の場合に fallback または warning を出せる。

---

#### MS-036: blockquote と list renderer を実装する

- Milestone: `0.1.0`
- Priority: P1
- Type: rust
- Depends on: MS-035

対象要素:

```txt
blockquote
ul
ol
li
```

Acceptance criteria:

- [ ] blockquote を `blockquote.hbs` で render できる。
- [ ] unordered list を `ul.hbs` と `li.hbs` で render できる。
- [ ] ordered list を `ol.hbs` と `li.hbs` で render できる。
- [ ] nested list は最低限壊れずに出力できる。

---

#### MS-037: core snapshot test を追加する

- Milestone: `0.1.0`
- Priority: P0
- Type: test
- Depends on: MS-035

Acceptance criteria:

- [ ] `examples/basic/article.md` を変換して `expected.html` と比較できる。
- [ ] Unknown theme の test がある。
- [ ] Missing template の test がある。
- [ ] Invalid frontmatter の test がある。

---

### 4.5 WASM integration

#### MS-040: `md-hinagata-wasm` crate を作成する

- Milestone: `0.1.0`
- Priority: P0
- Type: wasm
- Depends on: MS-030

作成する file:

```txt
crates/md-hinagata-wasm/
  Cargo.toml
  src/lib.rs
```

Acceptance criteria:

- [ ] `wasm-bindgen` で build できる。
- [ ] JS から `transform_json` を呼べる。
- [ ] panic hook を設定できる。

---

#### MS-041: WASM build script を作成する

- Milestone: `0.1.0`
- Priority: P0
- Type: build
- Depends on: MS-040

作成する file:

```txt
scripts/build-wasm.mjs
scripts/copy-wasm-to-extension.mjs
```

Acceptance criteria:

- [ ] root script から WASM を build できる。
- [ ] build artifact を VS Code extension 側にコピーできる。
- [ ] build 手順が README に記載されている。

---

#### MS-042: transformService から WASM を呼び出す

- Milestone: `0.1.0`
- Priority: P0
- Type: extension
- Depends on: MS-041

作成する file:

```txt
apps/vscode-extension/src/services/transformService.ts
```

Acceptance criteria:

- [ ] Markdown text と ThemePackage を WASM に渡せる。
- [ ] TransformResponse を受け取れる。
- [ ] transform error を user visible な diagnostic に変換できる。
- [ ] 変換処理が Preview Panel と Theme Manager から利用できる。

---

### 4.6 Theme resolution

#### MS-050: bundled theme resolver を実装する

- Milestone: `0.1.0`
- Priority: P0
- Type: extension
- Depends on: MS-010

作成する file:

```txt
apps/vscode-extension/src/services/themeResolver.ts
```

Acceptance criteria:

- [ ] extension bundled `themes/default` を読み込める。
- [ ] `theme.json`, `styles.css`, `templates/*.hbs` を ThemePackage に変換できる。
- [ ] theme file が欠けている場合に diagnostic を出せる。

---

#### MS-051: workspace theme resolver を実装する

- Milestone: `0.1.0`
- Priority: P0
- Type: extension
- Depends on: MS-050

探索対象:

```txt
workspace/.md-hinagata/themes/{themeId}
```

Acceptance criteria:

- [ ] workspace theme を bundled theme より優先できる。
- [ ] `.md-hinagata/themes/{themeId}/theme.json` を読める。
- [ ] workspace theme が壊れている場合に diagnostic を出せる。
- [ ] workspace がない場合にも bundled theme だけで動く。

---

#### MS-052: active document state を管理する

- Milestone: `0.1.0`
- Priority: P0
- Type: extension
- Depends on: MS-042, MS-051

作成する file:

```txt
apps/vscode-extension/src/services/documentStateService.ts
```

管理する state:

```txt
active Markdown document
resolved theme id
current generated html
current css
current diagnostics
current theme files
```

Acceptance criteria:

- [ ] active editor が変わった時に state が更新される。
- [ ] Markdown file 以外では適切に inactive state になる。
- [ ] Preview と Theme Manager が同じ state を参照できる。
- [ ] Copy Generated HTML が最新の html を使える。

---

### 4.7 Frontmatter update

#### MS-060: frontmatter updater を実装する

- Milestone: `0.1.0`
- Priority: P0
- Type: extension
- Depends on: MS-021

作成する file:

```txt
apps/vscode-extension/src/frontmatter/updateFrontmatter.ts
```

対応する操作:

```txt
frontmatter がない場合:
  先頭に hinagata block を追加する

frontmatter がある場合:
  hinagata.theme を追加または更新する

frontmatter が壊れている場合:
  自動更新しない
```

Acceptance criteria:

- [ ] `Select Theme` で `hinagata.theme` を更新できる。
- [ ] 既存の `title`, `tags` などを壊さない。
- [ ] frontmatter がない Markdown に frontmatter を追加できる。
- [ ] YAML が壊れている場合は warning を出して更新しない。

---

#### MS-061: Select Theme command を実装する

- Milestone: `0.1.0`
- Priority: P0
- Type: extension
- Depends on: MS-060, MS-051

Acceptance criteria:

- [ ] available themes を Quick Pick で表示できる。
- [ ] theme 選択時に active Markdown の frontmatter を更新できる。
- [ ] 更新後に Preview と Theme Manager が refresh される。
- [ ] theme が存在しない場合は選択肢に出さない。

---

### 4.8 Preview behavior

#### MS-070: Markdown change で Preview を更新する

- Milestone: `0.1.0`
- Priority: P0
- Type: extension
- Depends on: MS-042, MS-052

Acceptance criteria:

- [ ] `onDidChangeTextDocument` で active Markdown の変更を検知できる。
- [ ] debounce して transform を実行できる。
- [ ] Preview Panel に HTML と CSS を送れる。
- [ ] Theme Manager に diagnostics を送れる。

---

#### MS-071: theme file 保存で Preview を更新する

- Milestone: `0.1.0`
- Priority: P0
- Type: extension
- Depends on: MS-051, MS-070

監視対象:

```txt
theme.json
styles.css
templates/*.hbs
```

Acceptance criteria:

- [ ] 使用中 theme の file 保存時に再変換できる。
- [ ] 未使用 theme の保存では不要な再変換を避けられる。
- [ ] template 保存後に Preview が更新される。
- [ ] styles.css 保存後に Preview の見た目が更新される。

---

#### MS-072: Copy Generated HTML command を実装する

- Milestone: `0.1.0`
- Priority: P0
- Type: extension
- Depends on: MS-052

Acceptance criteria:

- [ ] 最新の generated HTML を clipboard にコピーできる。
- [ ] HTML が未生成の場合は変換してからコピーできる。
- [ ] コピー成功時に VS Code notification を出せる。
- [ ] エラー時に分かりやすい message を出せる。

---

### 4.9 Theme Manager UI

#### MS-080: Current Document section を表示する

- Milestone: `0.1.0`
- Priority: P0
- Type: UI
- Depends on: MS-023, MS-052

表示内容:

```txt
Current Document
  Theme: default
  Output: fragment
  Status: Ready
```

Acceptance criteria:

- [ ] active Markdown の theme id を表示できる。
- [ ] resolved theme id を表示できる。
- [ ] fallback が発生している場合に分かる。
- [ ] Markdown file が active でない場合に empty state を表示できる。

---

#### MS-081: Theme Files section を表示する

- Milestone: `0.1.0`
- Priority: P0
- Type: UI
- Depends on: MS-080

表示内容:

```txt
Theme Files
  theme.json
  styles.css

Templates
  h1.hbs
  h2.hbs
  h3.hbs
  p.hbs
  codeblock.hbs
```

Acceptance criteria:

- [ ] 現在 theme の template 一覧を表示できる。
- [ ] `theme.json` をクリックして VS Code editor で開ける。
- [ ] `styles.css` をクリックして VS Code editor で開ける。
- [ ] template をクリックして VS Code editor で開ける。

---

#### MS-082: Actions section を表示する

- Milestone: `0.1.0`
- Priority: P1
- Type: UI
- Depends on: MS-081

Actions:

```txt
Open Preview
Select Theme
Copy Generated HTML
```

Acceptance criteria:

- [ ] 左パネルから Open Preview を実行できる。
- [ ] 左パネルから Select Theme を実行できる。
- [ ] 左パネルから Copy Generated HTML を実行できる。

---

#### MS-083: Diagnostics section を表示する

- Milestone: `0.1.0`
- Priority: P0
- Type: UI
- Depends on: MS-080

表示対象:

```txt
Unknown theme
Missing template
Invalid frontmatter
Invalid theme manifest
Template render error
```

Acceptance criteria:

- [ ] diagnostics がない場合に `No issues` を表示できる。
- [ ] warning と error を区別して表示できる。
- [ ] message が読みやすい。
- [ ] refresh 後に diagnostics が更新される。

---

### 4.10 Diagnostics

#### MS-090: Diagnostic model を定義する

- Milestone: `0.1.0`
- Priority: P0
- Type: core
- Depends on: MS-031

想定型:

```rust
pub struct Diagnostic {
    pub severity: DiagnosticSeverity,
    pub code: String,
    pub message: String,
}
```

Acceptance criteria:

- [ ] severity は `error`, `warning`, `info` を表現できる。
- [ ] code は stable な string として扱える。
- [ ] VS Code 側で表示しやすい JSON になる。

---

#### MS-091: 基本 diagnostics を実装する

- Milestone: `0.1.0`
- Priority: P0
- Type: core
- Depends on: MS-090

対象:

```txt
UNKNOWN_THEME
MISSING_TEMPLATE
INVALID_FRONTMATTER
INVALID_THEME_MANIFEST
TEMPLATE_RENDER_ERROR
```

Acceptance criteria:

- [ ] Unknown theme 時に diagnostic が返る。
- [ ] Missing template 時に diagnostic が返る。
- [ ] Invalid frontmatter 時に diagnostic が返る。
- [ ] Template render error 時に diagnostic が返る。

---

#### MS-092: VS Code Problems 連携の下準備をする

- Milestone: `0.1.0`
- Priority: P2
- Type: extension
- Depends on: MS-091

0.1.0 では Theme Manager 表示だけでも可。Problems 連携は 0.2.0 に送ってよい。

Acceptance criteria:

- [ ] diagnosticsService の interface がある。
- [ ] 将来 `DiagnosticCollection` に接続できる設計になっている。

---

### 4.11 Security basics

#### MS-100: Webview CSP を設定する

- Milestone: `0.1.0`
- Priority: P0
- Type: security
- Depends on: MS-022, MS-023

Acceptance criteria:

- [ ] Preview Webview に CSP meta tag がある。
- [ ] Theme Manager Webview に CSP meta tag がある。
- [ ] script nonce を使う。
- [ ] 不要な external resource を許可しない。

---

#### MS-101: raw HTML default off を実装する

- Milestone: `0.1.0`
- Priority: P0
- Type: security
- Depends on: MS-035

Acceptance criteria:

- [ ] Markdown 内 raw HTML は default で無効化または escape される。
- [ ] raw HTML を無効化した場合に unexpected な script が Preview に出ない。
- [ ] 将来 option で有効化できる余地がある。

---

#### MS-102: Workspace Trust の基本対応をする

- Milestone: `0.1.0`
- Priority: P1
- Type: security
- Depends on: MS-051

Acceptance criteria:

- [ ] untrusted workspace では workspace theme の利用を制限できる。
- [ ] bundled theme は untrusted workspace でも利用できる。
- [ ] Theme Manager に制限状態を表示できる。
- [ ] package.json に Workspace Trust capability を設定する。

---

### 4.12 Documentation and release

#### MS-110: README を MVP 内容に合わせて更新する

- Milestone: `0.1.0`
- Priority: P0
- Type: docs

Acceptance criteria:

- [ ] md-hinagata の目的が説明されている。
- [ ] frontmatter の例がある。
- [ ] theme.json の例がある。
- [ ] 開発手順がある。
- [ ] `0.x.x preview` であることが明記されている。

---

#### MS-111: docs を整備する

- Milestone: `0.1.0`
- Priority: P0
- Type: docs

対象:

```txt
docs/requirements.ja.md
docs/design.ja.md
docs/tasks.ja.md
```

Acceptance criteria:

- [ ] 要件定義が MVP scope と一致している。
- [ ] 設計ドキュメントが現在の directory structure と一致している。
- [ ] タスク一覧が GitHub Issue 化しやすい粒度になっている。

---

#### MS-112: 0.1.0 preview package を作る

- Milestone: `0.1.0`
- Priority: P1
- Type: release
- Depends on: MS-110

Acceptance criteria:

- [ ] VSIX を生成できる。
- [ ] 手元の VS Code に install できる。
- [ ] example Markdown で Preview と Copy HTML が動作する。
- [ ] release note draft がある。

---

## 5. `0.1.x` タスク候補

`0.1.x` では大きな仕様変更を避け、MVP の安定化を優先します。

### 5.1 `0.1.1` 候補

- [ ] Preview update の debounce を調整する。
- [ ] active editor 切り替え時の state bug を修正する。
- [ ] Windows path と POSIX path の差分を吸収する。
- [ ] theme file watcher の過剰発火を抑える。
- [ ] README の install 手順を改善する。
- [ ] Transform error の表示を改善する。

### 5.2 `0.1.2` 候補

- [ ] Webview CSP を強化する。
- [ ] Missing template warning の message を改善する。
- [ ] Invalid frontmatter 時の説明を改善する。
- [ ] Theme Manager の empty state を改善する。
- [ ] Copy HTML 成功 notification を改善する。

### 5.3 `0.1.3` 候補

- [ ] Theme Manager の UI spacing を改善する。
- [ ] template 一覧の並び順を固定する。
- [ ] theme.json の schema validation を改善する。
- [ ] examples を増やす。
- [ ] simple corporate theme fixture を追加する。

---

## 6. `0.2.0` backlog

`0.2.0` は Theme Manager と diagnostics を強化する milestone として扱います。

### Theme management

- [ ] `Create Workspace Theme` command を追加する。
- [ ] `Duplicate Theme` command を追加する。
- [ ] `Open Current Theme` command を追加する。
- [ ] `Create Missing Template` action を追加する。
- [ ] workspace theme と bundled theme の差分表示を検討する。
- [ ] user configured theme paths を追加する。
- [ ] global user theme directory を検討する。

### Validation

- [ ] `Validate Current Theme` command を追加する。
- [ ] theme.json schema validation を本格実装する。
- [ ] template variable validation を実装する。
- [ ] unknown variable warning を出す。
- [ ] unused required variable warning を検討する。
- [ ] VS Code Problems 連携を実装する。

### Output

- [ ] `Open Generated HTML` panel を追加する。
- [ ] `Export HTML Fragment` command を追加する。
- [ ] `Export Full HTML` command を追加する。
- [ ] `document.hbs` を使った full HTML export を検討する。

### Markdown elements

- [ ] `link` template 対応を追加する。
- [ ] `image` template 対応を追加する。
- [ ] `inline_code` template 対応を追加する。
- [ ] `strong` template 対応を追加する。
- [ ] `em` template 対応を追加する。
- [ ] `hr` template 対応を追加する。

---

## 7. `0.3.0` backlog

`0.3.0` は VS Code 拡張外の利用と配布体験を広げる milestone として扱います。

### CLI

- [ ] `md-hinagata-cli` crate を追加する。
- [ ] `md-hinagata build article.md --out article.html` を実装する。
- [ ] `md-hinagata validate-theme path/to/theme` を実装する。
- [ ] `md-hinagata export "docs/**/*.md" --out dist` を実装する。
- [ ] CI で使える exit code を設計する。

### Theme package

- [ ] `.md-hinagata-theme` または `.hinagata-theme` の拡張子を決める。
- [ ] theme package export を実装する。
- [ ] theme package import を実装する。
- [ ] zip slip 対策を実装する。
- [ ] file size limit を実装する。
- [ ] allowed extension policy を実装する。

### Syntax highlight

- [ ] Preview 向け lightweight highlight を検討する。
- [ ] CLI 向け Rust native highlight を検討する。
- [ ] `highlighted_html` 変数を設計する。
- [ ] code block hash cache を検討する。

---

## 8. `0.4.0` 以降の backlog

### Preview inspector

- [ ] Preview 要素 click で対応 template を開く。
- [ ] Markdown block と HTML output の対応関係を表示する。
- [ ] Template variable inspector を表示する。
- [ ] Markdown token inspector を表示する。

### Advanced theme editor

- [ ] 左パネル内の軽量 template editor を検討する。
- [ ] GUI で class name を編集する機能を検討する。
- [ ] design token を theme.json に持たせるか検討する。
- [ ] CSS variables editor を検討する。

### Product expansion

- [ ] Web App を検討する。
- [ ] Tauri standalone app を検討する。
- [ ] CMS preset theme を追加する。
- [ ] newsletter preset theme を追加する。
- [ ] design system preset theme を追加する。

---

## 9. 実装順序

推奨順序は以下です。

```txt
1. MS-001 monorepo skeleton
2. MS-010 default theme
3. MS-011 example Markdown
4. MS-020 VS Code extension skeleton
5. MS-021 commands
6. MS-022 Preview Panel skeleton
7. MS-023 Theme Manager skeleton
8. MS-030 Rust core crate
9. MS-031 TransformRequest / TransformResponse
10. MS-032 frontmatter parser
11. MS-033 ThemePackage model
12. MS-034 Handlebars rendering
13. MS-035 Markdown renderer
14. MS-037 core snapshot test
15. MS-040 WASM crate
16. MS-041 WASM build script
17. MS-042 transformService
18. MS-050 bundled theme resolver
19. MS-051 workspace theme resolver
20. MS-052 document state service
21. MS-070 Markdown change preview update
22. MS-071 theme file save preview update
23. MS-080 Theme Manager Current Document
24. MS-081 Theme Manager Theme Files
25. MS-083 diagnostics section
26. MS-072 Copy Generated HTML
27. MS-060 frontmatter updater
28. MS-061 Select Theme command
29. MS-100 Webview CSP
30. MS-101 raw HTML default off
31. MS-110 README update
32. MS-111 docs update
33. MS-112 0.1.0 preview package
```

`MS-036`, `MS-082`, `MS-102` は P1 として、余力があれば `0.1.0` に含めます。間に合わない場合は `0.1.1` または `0.2.0` に送ります。

---

## 10. リスクと対策

### 10.1 WASM 統合が詰まる

Risk:

- VS Code extension から WASM を読み込む部分で時間を使いすぎる。

Mitigation:

- 最初は JSON 入出力だけにする。
- Worker 化は後回しにする。
- どうしても詰まる場合は一時的に TypeScript mock transformer を使い、UI 開発を止めない。

### 10.2 Markdown renderer が複雑になる

Risk:

- list や nested block の変換が複雑になり、0.1.0 が遅れる。

Mitigation:

- P0 は `h1`, `h2`, `h3`, `p`, `codeblock` に絞る。
- `blockquote`, `ul`, `ol`, `li` は P1 として扱う。
- table, image, link は 0.2.0 以降へ送る。

### 10.3 Theme Manager を作り込みすぎる

Risk:

- 左パネルに本格エディタを入れたくなり、MVP が重くなる。

Mitigation:

- 0.1.0 では Theme Manager / Inspector に限定する。
- 実編集は VS Code 標準エディタで行う。
- 左パネル内 editor は 0.4.0 以降の検討事項にする。

### 10.4 Security 対応が後回しになる

Risk:

- Webview, HTML, CSS, template を扱うため、雑に作ると危険になる。

Mitigation:

- 0.1.0 から CSP と raw HTML default off を入れる。
- workspace theme と Workspace Trust の扱いを最低限決める。
- 高度な sanitize policy は 0.2.0 以降で強化する。

---

## 11. GitHub Project の推奨 view

### Board columns

```txt
Backlog
Ready
In Progress
Review
Blocked
Done
```

### Fields

```txt
Milestone
Priority
Area
Type
Depends on
```

### Area values

```txt
setup
extension
webview
rust-core
wasm
theme
frontmatter
diagnostics
security
docs
release
```

### Type values

```txt
feature
bug
refactor
test
docs
spike
```

---

## 12. 初回に作る Issue 一覧

最初に GitHub Issue 化するなら、以下から始めます。

```txt
#1  Create monorepo skeleton
#2  Add bundled default theme
#3  Add basic example Markdown fixture
#4  Create VS Code extension skeleton
#5  Register core commands
#6  Add Preview Webview Panel skeleton
#7  Add Theme Manager Webview View skeleton
#8  Create md-hinagata-core crate
#9  Define TransformRequest and TransformResponse
#10 Implement frontmatter parser
#11 Implement ThemePackage model
#12 Implement Handlebars template rendering
#13 Implement h1/h2/h3/p/codeblock renderer
#14 Add core snapshot tests
#15 Create md-hinagata-wasm crate
#16 Add WASM build script
#17 Connect transformService to WASM
#18 Implement bundled theme resolver
#19 Implement workspace theme resolver
#20 Implement document state service
#21 Update Preview on Markdown change
#22 Update Preview on theme file save
#23 Render current document state in Theme Manager
#24 Render theme files in Theme Manager
#25 Render diagnostics in Theme Manager
#26 Implement Copy Generated HTML command
#27 Implement frontmatter updater
#28 Implement Select Theme command
#29 Add Webview CSP
#30 Disable raw HTML by default
#31 Update README and docs
#32 Package 0.1.0 preview build
```

---

## 13. 0.1.0 で保留する判断

以下は 0.1.0 では決め切らなくてよいですが、将来のために記録します。

- [ ] theme package 拡張子を `.md-hinagata-theme` にするか `.hinagata-theme` にするか。
- [ ] full HTML export 用に `document.hbs` を必須化するか。
- [ ] syntax highlight を Rust core で行うか、Preview 側で行うか。
- [ ] CLI command 名を `md-hinagata` にするか `hinagata` にするか。
- [ ] table 対応を 0.2.0 に入れるか、0.3.0 以降に送るか。
- [ ] VS Code Marketplace 表示名を `md-hinagata` にするか `md-hinagata Studio` にするか。

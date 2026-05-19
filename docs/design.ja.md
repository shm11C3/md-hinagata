# md-hinagata 設計ドキュメント

> Initial target: `0.1.0` MVP  
> Related document: `docs/requirements.ja.md`

md-hinagata は、VS Code 上で Markdown を編集し、frontmatter で指定したテーマテンプレートを使って、構造を制御した HTML fragment を生成するための開発環境である。

この設計ドキュメントは、`0.1.0` MVP を実装するためのアーキテクチャ、責務分離、データフロー、モジュール構成、API 境界を定義する。

---

## 1. 設計方針

### 1.1 基本方針

md-hinagata は、普通の Markdown プレビュー拡張ではない。

主役はプレビューではなく、**Markdown 要素をテーマテンプレートという型紙に通して、最終的な HTML 構造を制御すること**である。

```txt
Markdown + frontmatter + theme templates
  -> Rust/WASM transform core
  -> structured HTML fragment
  -> preview / copy / export
```

### 1.2 重要な判断

```txt
Markdown 編集
  VS Code 標準エディタに任せる。

Theme Manager
  左サイドバーの Webview View として実装する。

Preview
  右側の Webview Panel として実装する。

変換処理
  Rust core を WASM 経由で呼び出す。

テーマ指定
  Markdown の frontmatter に置く。

テーマ編集
  左パネルで管理し、実編集は VS Code 標準エディタで行う。
```

### 1.3 設計上の非目標

`0.1.0` では以下を作らない。

- 独自 Markdown エディタ。
- WYSIWYG エディタ。
- CMS 投稿機能。
- CLI。
- Tauri app。
- theme package import/export。
- 左パネル内の本格コードエディタ。
- preview 要素クリックから template を開く機能。
- table / image / link の完全対応。
- 高度な syntax highlight。

---

## 2. 全体アーキテクチャ

### 2.1 コンポーネント構成

```txt
VS Code Extension
  ├─ Commands
  ├─ Theme Manager View
  ├─ Preview Panel
  ├─ Transform Service
  ├─ Theme Resolver
  ├─ Document State Service
  ├─ Diagnostics Service
  └─ Frontmatter Updater

Rust/WASM Transform Core
  ├─ Frontmatter Parser
  ├─ Markdown Parser
  ├─ Theme Model
  ├─ Template Engine
  ├─ Renderer
  ├─ Sanitizer
  └─ Diagnostics

Theme Files
  ├─ theme.json
  ├─ styles.css
  └─ templates/*.hbs
```

### 2.2 実行時データフロー

```txt
Markdown TextDocument
  ↓
VS Code Extension
  ↓ document text を取得
ThemeResolver
  ↓ workspace theme / bundled theme を読み込み
TransformService
  ↓ JSON request
Rust/WASM Core
  ↓ HTML / CSS / diagnostics
PreviewPanel
  ↓ Webview に表示
ThemeManagerView
  ↓ 現在 theme / template / warning を表示
```

### 2.3 変換フロー

```txt
1. Markdown text を受け取る
2. frontmatter を parse する
3. hinagata.theme を解決する
4. theme package を選択する
5. Markdown 本文を parse する
6. Markdown node ごとに template context を作る
7. Handlebars template を render する
8. HTML fragment を組み立てる
9. 必要なら sanitize する
10. TransformResponse を返す
```

---

## 3. リポジトリ構成

`0.1.0` では以下の構成を基本とする。

```txt
md-hinagata/
  package.json
  pnpm-workspace.yaml
  Cargo.toml
  README.md
  README.ja.md
  LICENSE

  apps/
    vscode-extension/
      package.json
      tsconfig.json
      esbuild.config.ts

      src/
        extension.ts

        commands/
          openPreviewCommand.ts
          copyGeneratedHtmlCommand.ts
          selectThemeCommand.ts

        panels/
          previewPanel.ts

        views/
          themeEditorViewProvider.ts

        services/
          transformService.ts
          themeResolver.ts
          documentStateService.ts
          diagnosticsService.ts
          workspaceTrustService.ts

        frontmatter/
          updateFrontmatter.ts

        utils/
          debounce.ts
          webviewHtml.ts
          uri.ts

      media/
        preview/
          main.ts
          styles.css

        theme-editor/
          main.ts
          styles.css

      resources/
        md-hinagata.svg

  crates/
    md-hinagata-core/
      Cargo.toml
      src/
        lib.rs
        transform.rs
        frontmatter.rs
        markdown.rs
        theme.rs
        template.rs
        renderer.rs
        sanitize.rs
        diagnostics.rs
        error.rs

    md-hinagata-wasm/
      Cargo.toml
      src/
        lib.rs

  themes/
    default/
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

  examples/
    basic/
      sample.md
      expected.html

  schemas/
    theme.schema.json
    frontmatter.schema.json

  docs/
    requirements.ja.md
    design.ja.md
```

### 3.1 命名方針

```txt
Product name:
  md-hinagata

Repository name:
  md-hinagata

Frontmatter namespace:
  hinagata

Workspace config directory:
  .md-hinagata

Rust core crate:
  md-hinagata-core

Rust WASM crate:
  md-hinagata-wasm
```

---

## 4. VS Code Extension 設計

### 4.1 責務

VS Code Extension は、VS Code との接続を担当する。

具体的な責務は以下である。

- 拡張の起動。
- コマンド登録。
- 左サイドバー Theme Manager の表示。
- 右 Preview Panel の表示。
- Markdown TextDocument の監視。
- theme file の監視。
- workspace theme / bundled theme の読み込み。
- Rust/WASM core の呼び出し。
- frontmatter の更新。
- 生成 HTML のコピー。
- diagnostics の表示。

逆に、Markdown 変換そのものは担当しない。

### 4.2 `extension.ts`

`extension.ts` は拡張の entrypoint である。

責務は最小限にする。

```txt
extension.ts
  - activate
  - deactivate
  - service の生成
  - command の登録
  - view provider の登録
  - event listener の登録
```

疑似コード。

```ts
export function activate(context: vscode.ExtensionContext) {
  const documentStateService = new DocumentStateService();
  const themeResolver = new ThemeResolver(context);
  const transformService = new TransformService(context);
  const diagnosticsService = new DiagnosticsService();

  const previewPanel = new PreviewPanel(
    context,
    transformService,
    themeResolver,
    documentStateService,
    diagnosticsService
  );

  const themeEditorViewProvider = new ThemeEditorViewProvider(
    context,
    themeResolver,
    documentStateService,
    diagnosticsService
  );

  registerCommands(context, {
    previewPanel,
    themeResolver,
    documentStateService,
  });

  registerDocumentWatchers(context, {
    previewPanel,
    documentStateService,
  });
}
```

### 4.3 Commands

`0.1.0` で登録するコマンド。

```txt
md-hinagata.openPreview
md-hinagata.copyGeneratedHtml
md-hinagata.selectTheme
```

将来候補。

```txt
md-hinagata.openGeneratedHtml
md-hinagata.validateTheme
md-hinagata.createTheme
md-hinagata.createMissingTemplate
md-hinagata.exportHtml
```

### 4.4 Theme Manager View

左サイドバーの Webview View として実装する。

```txt
views/
  themeEditorViewProvider.ts
```

#### 4.4.1 役割

Theme Manager は、現在の Markdown 文書に対するテーマ状態を表示する。

表示内容。

```txt
Current Document
  Theme: default
  Output: fragment

Theme Files
  theme.json
  styles.css

Templates
  h1.hbs
  h2.hbs
  h3.hbs
  p.hbs
  codeblock.hbs
  blockquote.hbs
  ul.hbs
  ol.hbs
  li.hbs

Actions
  Open Preview
  Copy Generated HTML
  Select Theme

Diagnostics
  Unknown theme
  Missing template
  Template render error
```

#### 4.4.2 編集方針

左パネル内に本格的な editor は置かない。

テンプレートや CSS の実編集は VS Code 標準エディタで行う。

```txt
左パネルで h2.hbs をクリック
  -> VS Code 標準エディタで templates/h2.hbs を開く
  -> 保存
  -> preview 更新
```

#### 4.4.3 Webview message

Theme Manager Webview から Extension Host へ送る message。

```ts
type ThemeManagerMessage =
  | { type: "openPreview" }
  | { type: "copyGeneratedHtml" }
  | { type: "selectTheme" }
  | { type: "openThemeFile"; path: string }
  | { type: "openTemplate"; templateKey: string };
```

Extension Host から Theme Manager Webview へ送る state。

```ts
type ThemeManagerState = {
  activeDocumentPath?: string;
  frontmatter?: {
    theme?: string;
    output?: string;
  };
  resolvedTheme?: {
    id: string;
    name: string;
    version: string;
    source: "workspace" | "bundled";
  };
  templates: Array<{
    key: string;
    path: string;
    exists: boolean;
  }>;
  diagnostics: Diagnostic[];
};
```

### 4.5 Preview Panel

右側の Webview Panel として実装する。

```txt
panels/
  previewPanel.ts
```

#### 4.5.1 役割

- 変換後 HTML を表示する。
- theme CSS を適用する。
- diagnostics がある場合は簡易表示する。
- Markdown 変更時に再描画する。
- theme file 保存時に再描画する。

#### 4.5.2 Preview HTML の構成

Webview には以下を送る。

```ts
type PreviewState = {
  html: string;
  css?: string;
  diagnostics: Diagnostic[];
};
```

Webview 側では以下のように描画する。

```html
<style id="theme-css"></style>
<div id="diagnostics"></div>
<main id="preview-root"></main>
```

#### 4.5.3 更新タイミング

```txt
Markdown document changed
  -> debounce 300ms
  -> transform
  -> preview update

Markdown document saved
  -> transform
  -> preview update

Theme file saved
  -> reload theme
  -> transform
  -> preview update

Theme selected
  -> update frontmatter
  -> transform
  -> preview update
```

### 4.6 Transform Service

```txt
services/
  transformService.ts
```

#### 4.6.1 役割

- Rust/WASM module を初期化する。
- TransformRequest を作る。
- `transform_markdown` を呼び出す。
- TransformResponse を TypeScript 側に返す。
- 最新の生成 HTML を cache する。

#### 4.6.2 WASM 呼び出し方針

`0.1.0` では JSON 入出力でよい。

```ts
const response = await wasm.transformMarkdownJson(request);
```

最適化は後回し。

将来、巨大文書で重くなった場合は worker 化する。

### 4.7 Theme Resolver

```txt
services/
  themeResolver.ts
```

#### 4.7.1 役割

- frontmatter の theme id から theme package を読み込む。
- workspace theme と bundled theme を探索する。
- `theme.json`、`styles.css`、`templates/*.hbs` を読み込む。
- Rust core に渡せる `ThemePackage` を作る。

#### 4.7.2 探索順

`0.1.0` の探索順。

```txt
1. workspace/.md-hinagata/themes/{themeId}
2. bundled themes/{themeId}
```

将来候補。

```txt
3. user configured theme paths
4. global user theme directory
```

#### 4.7.3 ThemeSource

```ts
type ThemeSource = "workspace" | "bundled";
```

ThemePackage。

```ts
type ThemePackage = {
  id: string;
  name: string;
  version: string;
  source: ThemeSource;
  css?: string;
  templates: Record<string, string>;
  manifest: ThemeManifest;
};
```

### 4.8 Document State Service

```txt
services/
  documentStateService.ts
```

#### 4.8.1 役割

- active Markdown document を管理する。
- 現在の TransformResponse を保持する。
- 現在の generated HTML を保持する。
- 現在の resolved theme を保持する。
- Theme Manager と Preview Panel に state を共有する。

State 例。

```ts
type DocumentState = {
  documentUri?: vscode.Uri;
  markdown?: string;
  frontmatter?: FrontmatterState;
  resolvedThemeId?: string;
  generatedHtml?: string;
  css?: string;
  diagnostics: Diagnostic[];
  lastTransformedAt?: number;
};
```

### 4.9 Diagnostics Service

```txt
services/
  diagnosticsService.ts
```

#### 4.9.1 役割

- Rust core から返された diagnostics を受け取る。
- Theme Manager に表示する。
- 必要に応じて VS Code Problems に表示する。

`0.1.0` では Theme Manager 表示を優先し、Problems 連携は軽めでよい。

---

## 5. Rust/WASM Core 設計

### 5.1 責務

Rust core は、Markdown と theme package を受け取り、HTML fragment を返す純粋な変換エンジンである。

責務。

- frontmatter parse。
- Markdown parse。
- theme manifest validation。
- template render。
- HTML fragment generation。
- diagnostics generation。
- optional sanitize。

非責務。

- VS Code API 操作。
- ファイル読み込み。
- workspace theme 探索。
- Webview 操作。
- Clipboard 操作。

### 5.2 Public API

TypeScript との境界では JSON を使う。

```ts
type TransformRequest = {
  markdown: string;
  themes: ThemePackage[];
  defaultThemeId?: string;
  options?: TransformOptions;
};

export type TransformOptions = {
  sanitize?: boolean;
  allowRawHtml?: boolean;
};

type TransformResponse = {
  html: string;
  css?: string;
  resolvedThemeId: string;
  frontmatter?: ParsedFrontmatter;
  diagnostics: Diagnostic[];
};
```

Rust 側の概念。

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
    pub frontmatter: Option<ParsedFrontmatter>,
    pub diagnostics: Vec<Diagnostic>,
}
```

### 5.3 WASM Bridge

```txt
crates/md-hinagata-wasm/src/lib.rs
```

WASM crate は薄くする。

責務は以下だけ。

```txt
JS value を受け取る
  -> serde で TransformRequest に変換
  -> md-hinagata-core::transform を呼ぶ
  -> TransformResponse を JS value として返す
```

疑似コード。

```rust
#[wasm_bindgen(js_name = transformMarkdownJson)]
pub fn transform_markdown_json(input: JsValue) -> Result<JsValue, JsValue> {
    console_error_panic_hook::set_once();

    let request: TransformRequest = serde_wasm_bindgen::from_value(input)
        .map_err(to_js_error)?;

    let response = md_hinagata_core::transform(request)
        .map_err(to_js_error)?;

    serde_wasm_bindgen::to_value(&response)
        .map_err(to_js_error)
}
```

### 5.4 Core module 構成

```txt
crates/md-hinagata-core/src/
  lib.rs
  transform.rs
  frontmatter.rs
  markdown.rs
  theme.rs
  template.rs
  renderer.rs
  sanitize.rs
  diagnostics.rs
  error.rs
```

#### `transform.rs`

変換処理の orchestration を担当する。

```txt
parse frontmatter
resolve theme
parse markdown
render markdown nodes
sanitize
return response
```

#### `frontmatter.rs`

- Markdown 先頭の YAML frontmatter を抽出する。
- `hinagata.theme` を読む。
- `hinagata.output` を読む。
- frontmatter を除いた Markdown body を返す。

#### `markdown.rs`

- Markdown parser を呼ぶ。
- Markdown AST または node sequence を作る。
- `0.1.0` 対象要素だけを renderer に渡す。

#### `theme.rs`

- ThemePackage を定義する。
- ThemeManifest を定義する。
- theme id を解決する。
- template の存在チェックを行う。

#### `template.rs`

- Handlebars engine を初期化する。
- theme templates を register する。
- template context を render する。

#### `renderer.rs`

- Markdown node を template context へ変換する。
- block ごとの template を呼ぶ。
- HTML fragment を組み立てる。

#### `sanitize.rs`

- `allowRawHtml` や `sanitize` option に応じて HTML を処理する。
- `0.1.0` では最小実装でよい。

#### `diagnostics.rs`

- Diagnostic の型を定義する。
- diagnostic code を定義する。
- warning / error を集約する。

---

## 6. Frontmatter 設計

### 6.1 基本形式

```md
---
hinagata:
  theme: default
  output: fragment
---

# Title

Body text.
```

### 6.2 対応 key

`0.1.0` では以下だけ対応する。

```yaml
hinagata:
  theme: string
  output: fragment
```

### 6.3 theme 解決

```txt
frontmatter.hinagata.theme がある
  -> 指定 theme を使う

frontmatter.hinagata.theme がない
  -> defaultThemeId を使う

指定 theme が見つからない
  -> default theme に fallback
  -> UNKNOWN_THEME diagnostic を返す
```

### 6.4 Select Theme の挙動

`md-hinagata.selectTheme` は、現在の Markdown 文書の frontmatter を更新する。

frontmatter がない場合。

```md
# Before

# Title
```

```md
# After

---
hinagata:
  theme: corporate
  output: fragment
---

# Title
```

既存 frontmatter がある場合。

```md
---
title: Article
---

# Title
```

```md
---
title: Article
hinagata:
  theme: corporate
  output: fragment
---

# Title
```

### 6.5 更新時の注意

- 壊れた YAML は自動修復しない。
- 壊れた YAML を検出した場合は warning を出す。
- 既存の frontmatter key をできるだけ保持する。
- `hinagata.theme` だけを更新する。

---

## 7. Theme 設計

### 7.1 Theme directory

Workspace theme。

```txt
project/
  .md-hinagata/
    themes/
      corporate/
        theme.json
        styles.css
        templates/
          h1.hbs
          h2.hbs
          p.hbs
          codeblock.hbs
```

Bundled theme。

```txt
md-hinagata/
  themes/
    default/
      theme.json
      styles.css
      templates/
        h1.hbs
        h2.hbs
        p.hbs
```

### 7.2 `theme.json`

`0.1.0` の schema。

```json
{
  "$schema": "https://raw.githubusercontent.com/shm11C3/md-hinagata/main/schemas/theme.schema.json",
  "schemaVersion": "0.1",
  "id": "default",
  "name": "Default",
  "version": "0.1.0",
  "entryCss": "styles.css",
  "templates": {
    "h1": "templates/h1.hbs",
    "h2": "templates/h2.hbs",
    "h3": "templates/h3.hbs",
    "p": "templates/p.hbs",
    "codeblock": "templates/codeblock.hbs",
    "blockquote": "templates/blockquote.hbs",
    "ul": "templates/ul.hbs",
    "ol": "templates/ol.hbs",
    "li": "templates/li.hbs"
  }
}
```

### 7.3 Template key

`0.1.0` で対応する template key。

```txt
h1
h2
h3
p
codeblock
blockquote
ul
ol
li
```

### 7.4 Template variables

#### heading

対象。

```txt
h1
h2
h3
```

Context。

```json
{
  "id": "section-title",
  "level": 2,
  "text": "Section Title",
  "inner_html": "Section Title"
}
```

Template 例。

```hbs
<h2 id="{{id}}" class="ms-heading ms-heading--h2">
  {{{inner_html}}}
</h2>
```

#### paragraph

Context。

```json
{
  "text": "Body text.",
  "inner_html": "Body text."
}
```

Template 例。

```hbs
<p class="ms-paragraph">
  {{{inner_html}}}
</p>
```

#### codeblock

Context。

```json
{
  "lang": "ts",
  "raw": "const message = \"hello\";",
  "code": "const message = &quot;hello&quot;;"
}
```

Template 例。

```hbs
<pre class="ms-codeblock"><code class="language-{{lang}}">{{code}}</code></pre>
```

`0.1.0` では syntax highlight は行わない。

#### blockquote

Context。

```json
{
  "inner_html": "<p>Quoted text.</p>"
}
```

Template 例。

```hbs
<blockquote class="ms-blockquote">
  {{{inner_html}}}
</blockquote>
```

#### list

Context。

```json
{
  "inner_html": "<li>Item</li>"
}
```

Template 例。

```hbs
<ul class="ms-list ms-list--unordered">
  {{{inner_html}}}
</ul>
```

```hbs
<ol class="ms-list ms-list--ordered">
  {{{inner_html}}}
</ol>
```

#### li

Context。

```json
{
  "inner_html": "Item"
}
```

Template 例。

```hbs
<li class="ms-list-item">
  {{{inner_html}}}
</li>
```

### 7.5 Escape policy

原則。

```txt
{{text}}
  escaped plain text

{{code}}
  escaped code text

{{{inner_html}}}
  Markdown から生成済みの HTML
```

`{{{ }}}` を許可する変数は限定する。

`0.1.0` で raw HTML は default off。

---

## 8. Renderer 設計

### 8.1 基本方針

Renderer は Markdown node を HTML に直接変換しない。

まず template context を作り、theme の template に渡す。

```txt
Markdown heading node
  -> HeadingContext
  -> h2.hbs
  -> HTML
```

### 8.2 fallback policy

template が存在しない場合。

```txt
1. diagnostic MISSING_TEMPLATE を出す
2. default built-in rendering を使う
```

例。

```txt
theme に blockquote template がない
  -> warning
  -> <blockquote>...</blockquote> で fallback
```

`0.1.0` では fallback を入れる。テンプレート不足で完全に変換不能にしない。

### 8.3 unsupported Markdown elements

未対応要素は、次のいずれかで処理する。

```txt
A. CommonMark default HTML に fallback
B. plain text として出す
C. diagnostic を出して無視する
```

`0.1.0` では A を基本とする。

### 8.4 output mode

`0.1.0` では `fragment` のみ対応する。

```txt
fragment
  body 部分の HTML だけを返す。
```

将来候補。

```txt
full
  document.hbs を使い、完整 HTML document を返す。
```

---

## 9. Preview 設計

### 9.1 Webview policy

Preview は Webview Panel で表示する。

```txt
VS Code Markdown editor
  left / center

md-hinagata Preview
  beside editor
```

### 9.2 CSS injection

`TransformResponse.css` を preview 内の `<style id="theme-css">` に挿入する。

```ts
webview.postMessage({
  type: "update",
  html: response.html,
  css: response.css,
  diagnostics: response.diagnostics,
});
```

### 9.3 Generated HTML cache

Copy Generated HTML では、最後に変換した HTML を使う。

```txt
TransformResponse.html
  -> DocumentState.generatedHtml
  -> clipboard
```

現在の状態が stale の場合は、copy 前に再変換する。

---

## 10. Security 設計

### 10.1 基本方針

md-hinagata は Markdown、HTML、CSS、template を扱うため、攻撃面が広い。

`0.1.0` でも最低限の制限を入れる。

### 10.2 raw HTML

`0.1.0` では raw HTML は default off。

```txt
allowRawHtml: false
```

Markdown 内の raw HTML は escape または無視する。

### 10.3 Webview CSP

Preview と Theme Manager の Webview には CSP を設定する。

基本方針。

```txt
script-src は nonce 付き script のみ
style-src は Webview local resource と nonce style のみ
img-src は https と data を必要に応じて許可
```

`0.1.0` では外部 script は許可しない。

### 10.4 Workspace Trust

Workspace theme は、信頼済み workspace でのみ有効にする。

```txt
Trusted workspace
  workspace theme を許可

Untrusted workspace
  bundled theme のみ許可
  workspace theme は無効
  raw HTML は無効
```

### 10.5 localResourceRoots

Webview の `localResourceRoots` は必要最小限にする。

```txt
extension media directory
bundled theme assets directory
```

`0.1.0` では theme assets は扱わない。したがって extension media のみに絞れる。

### 10.6 Sanitize

`0.1.0` では最低限の sanitize を行う。

将来的には theme ごとの sanitize policy を検討する。

---

## 11. Diagnostics 設計

### 11.1 Diagnostic type

```ts
type Diagnostic = {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  source?: "frontmatter" | "theme" | "template" | "markdown" | "renderer";
  file?: string;
  range?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
};
```

### 11.2 `0.1.0` diagnostic codes

```txt
UNKNOWN_THEME
INVALID_FRONTMATTER
INVALID_THEME_MANIFEST
MISSING_TEMPLATE
TEMPLATE_RENDER_ERROR
UNSUPPORTED_OUTPUT_MODE
RAW_HTML_DISABLED
```

### 11.3 表示先

`0.1.0` では以下に表示する。

```txt
Theme Manager View
Preview Panel の diagnostics area
```

将来、VS Code Problems 連携を強化する。

---

## 12. Performance 設計

### 12.1 Debounce

Markdown 入力時は debounce して変換する。

```txt
Default debounce:
  300ms
```

### 12.2 Template cache

`0.1.0` では、theme file 保存時に theme package を再読み込みする。

将来、以下を検討する。

```txt
compiled template cache
theme manifest cache
codeblock hash cache
section-level incremental render
```

### 12.3 WASM call

`0.1.0` では JSON 入出力でよい。

将来、大きな文書で問題が出たら以下を検討する。

```txt
Web Worker
binary serialization
incremental transform
```

---

## 13. Testing 設計

テストの配置と追加方針は `docs/testing.md` に従う。

### 13.1 Rust core tests

```txt
frontmatter parse test
theme manifest parse test
transform snapshot test
missing template diagnostic test
unknown theme diagnostic test
template render error test
```

Snapshot test 例。

```txt
examples/basic/sample.md
  -> transform
  -> examples/basic/expected.html と比較
```

### 13.2 VS Code extension tests

```txt
command registration test
frontmatter update test
theme resolver test
workspace theme resolver test
copy generated HTML test
```

### 13.3 Manual QA

`0.1.0` リリース前に確認する。

```txt
Markdown を編集すると preview が更新される
h2.hbs を保存すると preview が更新される
styles.css を保存すると preview が更新される
frontmatter の theme を変えると theme が切り替わる
Unknown theme で warning が出る
Copy Generated HTML が正しい HTML をコピーする
```

---

## 14. 実装順序

`0.1.0` は以下の順で実装する。

```txt
1. monorepo skeleton
2. default theme
3. example Markdown
4. VS Code extension skeleton
5. Preview Webview Panel
6. Theme Manager Webview View
7. Rust core crate
8. frontmatter parser
9. theme model
10. Handlebars template render
11. Markdown renderer: h1 / h2 / h3 / p / codeblock
12. Markdown renderer: blockquote / ul / ol / li
13. WASM bridge
14. TransformService と WASM 接続
15. bundled default theme resolver
16. workspace theme resolver
17. preview update on Markdown change
18. preview update on theme file save
19. Copy Generated HTML
20. Select Theme command
21. basic diagnostics
22. README / docs
23. package 0.1.0
```

---

## 15. `0.1.0` 受け入れ条件

`0.1.0` は以下を満たしたらリリース可能とする。

- VS Code で Markdown ファイルを開ける。
- `hinagata.theme` を frontmatter から読める。
- frontmatter がない場合に default theme を使える。
- workspace theme を `.md-hinagata/themes/{themeId}` から読み込める。
- bundled default theme を読み込める。
- `h1`、`h2`、`h3`、`p`、`codeblock` を template で変換できる。
- `blockquote`、`ul`、`ol`、`li` を template で変換できる。
- 左パネルに現在 theme と template 一覧が表示される。
- 左パネルから template を VS Code 標準エディタで開ける。
- 右 Preview Panel に変換結果が表示される。
- Markdown 編集で Preview が更新される。
- template 保存で Preview が更新される。
- styles.css 保存で Preview が更新される。
- Copy Generated HTML が動く。
- Unknown theme で warning が出る。
- Missing template で warning が出る。
- README の手順通りに動作確認できる。

---

## 16. 将来の拡張ポイント

### 16.1 `0.2.0` 候補

- theme validation 強化。
- VS Code Problems 連携。
- theme scaffold 作成。
- user theme paths。
- full HTML export。
- Open Generated HTML。
- JSON Schema 補完。
- sanitize policy 強化。

### 16.2 `0.3.0` 候補

- CLI。
- CI validation。
- batch export。
- `.md-hinagata-theme` package import/export。
- syntax highlight。

### 16.3 `0.4.0` 以降の候補

- preview 要素クリックから template を開く。
- template variable inspector。
- Markdown token inspector。
- design system preset。
- newsletter preset。
- Tauri standalone app。

---

## 17. 未決事項

`0.1.0` 実装中に決める。

- Rust Markdown parser を `comrak` にするか、別の parser にするか。
- Handlebars helper をどこまで許可するか。
- `inner_html` の sanitize 境界をどこに置くか。
- raw HTML を完全無効化するか、escape して表示するか。
- workspace theme を untrusted workspace で完全禁止するか、警告付きで bundled fallback にするか。
- `output: full` を 0.2.0 で入れるか、それ以降にするか。
- theme package 拡張子を `.md-hinagata-theme` にするか、別名にするか。

---

## 18. 設計の要約

md-hinagata 0.1.0 の設計は、以下に集約される。

```txt
VS Code 標準エディタで Markdown を書く
  -> frontmatter の hinagata.theme で theme を決める
  -> ThemeResolver が theme package を読む
  -> Rust/WASM core が Markdown を HTML fragment に変換する
  -> PreviewPanel が HTML と CSS を表示する
  -> ThemeManagerView が theme / template / diagnostics を表示する
  -> Copy Generated HTML で最終 HTML を使えるようにする
```

最初に作るべきものは、多機能な Markdown エディタではない。

**Markdown を theme template で HTML 化する体験が VS Code 上で成立すること**が、`0.1.0` の最重要ゴールである。

# md-hinagata

VS Code向けの、テーマ選択型 Markdown to HTML Studio です。

md-hinagata は、Markdownをテーマテンプレートに通して、構造を制御したHTMLへ変換するためのVS Code拡張とRust製変換エンジンです。Markdownを書き、frontmatterでテーマを選び、左パネルでテーマ構成を確認し、テンプレートを編集しながら、右側のプレビューと生成HTMLを確認できます。

md-hinagata は、ただのMarkdownプレビュー拡張ではありません。主役は見た目ではなく、**最終的に生成されるHTML構造の制御**です。

```txt
Markdown + frontmatter + theme templates
  -> Rust transform core
  -> structured HTML fragment
  -> preview / copy / export
```

## ステータス

md-hinagata は `0.x.x` 系として開発します。

最初の目標は `0.1.0` です。`0.1.0` は完成版ではなく、思想が体験できる縦切りMVPです。

```txt
Markdownを書く
  -> frontmatterでテーマを選ぶ
  -> 左パネルでテーマを確認する
  -> VS Codeでテンプレートを編集する
  -> テーマ適用後のHTMLをプレビューする
  -> 生成HTMLをコピーする
```

`0.x.x` の間は、theme schema、frontmatter schema、template variables、Rust APIが変わる可能性があります。

## なぜmd-hinagataを作るのか

多くのMarkdownツールは、以下のどれかを目的にしています。

- Markdownをプレビューする。
- 静的サイトを生成する。
- CMSコンテンツを管理する。
- MarkdownをPDF、docx、HTMLなどへ汎用変換する。

md-hinagata が狙うのは、もっと狭い領域です。

> Markdownのブロックを、テーマで定義したHTML構造へ変換する。

たとえば、このMarkdownは、

```md
## Notice

This action cannot be undone.
```

選択したテーマによって、こういうHTMLになります。

```html
<h2 id="notice" class="article-heading article-heading--level2">
  Notice
</h2>
<p class="article-body">
  This action cannot be undone.
</p>
```

テーマはCSSだけではありません。md-hinagataにおけるテーマは、テンプレート、CSS、メタデータ、出力ルールを含むパッケージです。

## 基本思想

### テーマ選択はMarkdown文書自身が持つ

Markdownファイルは、frontmatterで使用するテーマを指定します。

```md
---
hinagata:
  theme: default
  output: fragment
---

# Title

Body text.
```

これにより、文書ごとの出力が再現可能になります。VS Codeのグローバル設定ではなく、文書自身が「どのテーマでHTML化されるか」を持ちます。

### テーマはテンプレートパッケージ

テーマはこのようなディレクトリです。

```txt
.md-hinagata/
  themes/
    company-blog/
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

`theme.json` はテーマの定義ファイルです。

```json
{
  "id": "company-blog",
  "name": "Company Blog",
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

### テンプレートにはHandlebarsを使う

テンプレートファイルには `.hbs` を使います。`hbs` は Handlebars の拡張子です。

例: `templates/h2.hbs`

```hbs
<h2 id="{{id}}" class="article-heading article-heading--level2">
  {{{inner_html}}}
</h2>
```

例: `templates/codeblock.hbs`

```hbs
<pre class="code-block"><code class="language-{{lang}}">{{raw}}</code></pre>
```

変数の基本ルールは以下です。

```txt
{{text}}
  HTMLエスケープされたプレーンテキスト。

{{{inner_html}}}
  Markdownの子要素から生成されたHTML。

{{raw}}
  エスケープされた元テキスト。
```

雑にすべてを `{{{ }}}` にしない方針です。HTMLとして挿入できる変数は限定します。

## v0.1.0 MVPスコープ

`0.1.0` は意図的に小さく作ります。

### 0.1.0で入れるもの

- VS Code拡張。
- VS Code標準Markdownエディタを使う。
- `hinagata.theme` によるfrontmatterテーマ選択。
- 左サイドバーのTheme Manager。
- 右側のThemed Preview Webview。
- Rust製変換コア。
- Rust coreのWASM連携。
- Handlebarsベースのテーマテンプレート。
- 組み込み `default` テーマ。
- `.md-hinagata/themes/{themeId}` 配下のワークスペーステーマ。
- Markdown変更時のプレビュー更新。
- テーマファイル保存時のプレビュー更新。
- 生成HTMLのコピー。
- Unknown theme、missing template などの基本diagnostics。

最初に対応するMarkdown要素は以下です。

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

### 0.1.0で入れないもの

- WYSIWYG編集。
- CMSへの直接投稿。
- フル静的サイト生成。
- Tauriアプリ。
- CLI。
- テーマパッケージのimport/export。
- `.hinagata-theme` パッケージ。
- table対応。
- image / link のテンプレート対応。
- 高度なsyntax highlight。
- プレビュー要素クリックからテンプレートへジャンプする機能。
- 左パネル内の本格コードエディタ。

## VS Code上の体験

想定レイアウトは以下です。

```txt
+----------------------+--------------------------+
| Theme Manager        | Themed Preview           |
|                      |                          |
| Current Document     | テーマ適用後HTMLの表示    |
| Theme: company-blog  |                          |
|                      |                          |
| Theme Files          |                          |
| - theme.json         |                          |
| - styles.css         |                          |
|                      |                          |
| Templates            |                          |
| - h1.hbs             |                          |
| - h2.hbs             |                          |
| - p.hbs              |                          |
+----------------------+--------------------------+
| Markdown本文はVS Code標準エディタで編集する        |
+---------------------------------------------------+
```

左サイドバーは、Theme Manager / Inspector として使います。テンプレートファイルはVS Code標準エディタで開きます。これにより、編集、検索、diff、Git管理、フォーマットなどはVS Codeに任せます。

## テーマ解決

`0.1.0` では、テーマ探索順を以下にします。

```txt
1. workspace/.md-hinagata/themes/{themeId}
2. bundled themes/{themeId}
```

将来的には、ユーザー定義のtheme pathsやテーマパッケージのimport/exportを追加します。

## ディレクトリ構成

MVP時点の想定構成です。

```txt
md-hinagata/
  package.json
  pnpm-workspace.yaml
  Cargo.toml
  README.md
  README.ja.md

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
        frontmatter/
          updateFrontmatter.ts
        utils/
          webviewHtml.ts
          debounce.ts
      media/
        preview/
        theme-editor/
      resources/
        md-hinagata.svg

  crates/
    md-hinagata-core/
      Cargo.toml
      src/
        lib.rs
        transform.rs
        frontmatter.rs
        theme.rs
        template.rs
        renderer.rs
        diagnostics.rs

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
      article.md
      expected.html

  schemas/
    theme.schema.json
    frontmatter.schema.json
```

## 開発セットアップ

必要なもの:

- Node.js 22 または 24 と `pnpm` 10.x。
- Cargo を含む Rust toolchain。
- WASM bridge build 用の `wasm-bindgen` CLI `0.2.121`。

JavaScript workspace の依存関係をインストールします。

```bash
pnpm install
```

Rust workspace を確認します。

```bash
cargo check --workspace
```

extension 用の Rust bridge をビルドする場合は、WASM bridge CLI をインストールします。

```bash
cargo install wasm-bindgen-cli --version 0.2.121 --locked
```

現在の workspace checks を実行します。

```bash
pnpm run check
pnpm run format
pnpm run lint
pnpm run test
```

`pnpm run format` は VS Code extension と Rust workspace の両方を整形します。`pnpm run lint` は extension の Biome に続けて、Rust の formatting check と Clippy warnings を確認します。

VS Code extension bundle をビルドします。

```bash
pnpm run build
```

WASM bridge をビルドして、生成 module を VS Code extension 側へコピーします。

```bash
pnpm run build:wasm
```

生成された WASM files は `apps/vscode-extension/wasm/` に出力され、commit しません。

### Extension Development Host

VS Code で repository root を開き、F5 を押すか Run and Debug から `Run md-hinagata Extension` を選びます。

launch configuration は `apps/vscode-extension` を Extension Development Host として起動し、起動前に `md-hinagata: build extension` task を実行します。VSIX package は不要です。

preview で Rust/WASM transform path を確認する場合は、clone 後と Rust/WASM 変更後に以下を実行します。

```bash
pnpm run build:wasm
```

Extension Development Host では以下を確認します。

1. `examples/basic/article.md` などの Markdown file を開く。
2. `md-hinagata` Activity Bar container と Theme Manager view が表示される。
3. Command Palette から `md-hinagata: Open Preview` を実行する。
4. `md-hinagata: Copy Generated HTML` と `md-hinagata: Select Theme` が Command Palette に表示される。

## Rust coreの役割

Rustを使う理由は、VS Codeの編集体験をRustで置き換えるためではありません。Markdown編集はVS Codeがすでに強いです。

Rustは、変換エンジンを堅く作るために使います。

- Markdown / frontmatter parsing。
- テーマテンプレートのrendering。
- HTML generation。
- diagnostics。
- 将来のCLI / CI連携。
- 将来のbatch export。

VS Code拡張側とRust coreの責務は分けます。

```txt
VS Code extension:
  ファイルを読む
  Webviewを管理する
  frontmatterを書き換える
  workspace pathを解決する

Rust core:
  Markdownとtheme packageを受け取る
  HTMLを生成する
  diagnosticsを返す
```

## セキュリティ方針

md-hinagataはMarkdown、HTML、CSS、テンプレートを扱うため、セキュリティは最初から考えます。

予定しているデフォルト方針です。

- raw HTMLはデフォルトOFF。
- workspace themeはTrusted Workspaceでのみ有効。
- Webview CSPを設定する。
- WebviewのlocalResourceRootsを制限する。
- テーマパッケージimport時にはパスとサイズを検証する。
- 生成プレビューHTMLはsanitizeまたはsandbox化する。

## ロードマップ

### 0.1.x

MVPの安定化。

- プレビュー更新の安定化。
- diagnostics改善。
- theme file watcher改善。
- READMEとexamples改善。

### 0.2.x

テーマ作成体験の強化。

- Create Theme from Default。
- Duplicate Theme。
- Create Missing Template。
- Template variable inspector。
- theme validation強化。
- JSON Schema連携。

### 0.3.x

ツールとexportの拡張。

- CLI。
- CI validation。
- batch export。
- Open Generated HTML。
- full HTML export。

### Later

- テーマパッケージimport/export。
- `.hinagata-theme` package format。
- syntax highlight。
- link、image、table対応。
- プレビュー要素クリックからtemplateを開く機能。
- Tauri standalone app。

## ライセンス

md-hinagata は、コード、テーマ、examples、ユーザー作成コンテンツ、生成物でライセンスの扱いを分けます。

- Code: `MIT OR Apache-2.0`。
- Bundled themes: `MIT OR Apache-2.0`。
- User themes: author-defined。
- Examples: まずは `MIT OR Apache-2.0`。将来 `CC0-1.0` も検討。
- Generated HTML: tool license は生成 HTML の所有権を主張しない。

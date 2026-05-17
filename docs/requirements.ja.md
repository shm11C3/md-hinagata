# md-hinagata 要件定義

> Status: Draft for `0.x.x` development  
> Initial target: `0.1.0` MVP

md-hinagata は、VS Code 上で Markdown を編集し、frontmatter で指定したテーマテンプレートを使って、構造を制御した HTML fragment を生成するための開発環境である。

md-hinagata は、通常の Markdown プレビュー拡張ではない。主役は「見た目のプレビュー」ではなく、**最終的に生成される HTML 構造をテーマテンプレートで制御できること**である。

```txt
Markdown + frontmatter + theme templates
  -> Rust/WASM transform core
  -> structured HTML fragment
  -> preview / copy / export
```

---

## 1. プロダクト概要

### 1.1 プロダクト名

```txt
Product name: md-hinagata
Repository / package name: md-hinagata
Frontmatter namespace: hinagata
Workspace config directory: .md-hinagata
```

### 1.2 プロダクトの一文説明

md-hinagata は、Markdown をテーマテンプレートという「型紙」に通して、CMS、デザインシステム、社内 Wiki、ナレッジベースなどに投入しやすい HTML へ変換する VS Code 拡張である。

### 1.3 基本コンセプト

```txt
Markdown を書く
  -> frontmatter でテーマを選ぶ
  -> 左パネルでテーマ構成を確認する
  -> テンプレートを VS Code 標準エディタで編集する
  -> 右パネルでテーマ適用後のプレビューを見る
  -> 生成 HTML をコピーまたは出力する
```

### 1.4 主要な価値

- Markdown の書きやすさを保つ。
- VS Code 標準エディタの編集体験を利用する。
- テーマごとに HTML 構造を変えられる。
- 文書ごとに frontmatter でテーマを指定できる。
- 生成 HTML を確認し、コピーできる。
- Rust 製変換コアを使い、VS Code 拡張、将来の CLI、将来の CI 検証で同じ変換ロジックを使える。

---

## 2. 想定ユーザーと用途

### 2.1 想定ユーザー

- Markdown で記事やドキュメントを書く開発者。
- CMS や社内システムに HTML fragment を投入する編集者。
- 社内デザインシステムに沿った HTML を生成したいフロントエンドエンジニア。
- ナレッジベース、ヘルプセンター、社内 Wiki のコンテンツを Markdown で管理したいチーム。
- AI 生成 Markdown を承認済み HTML 構造へ整形したいチーム。

### 2.2 CMS 以外の用途

md-hinagata は CMS 専用ではない。以下の用途にも使える。

- デザインシステム準拠 HTML の生成。
- 社内 Wiki やナレッジベース向け HTML の生成。
- ヘルプセンター記事の HTML fragment 生成。
- リリースノート、製品告知、社内告知の定型 HTML 化。
- 教材、研修コンテンツ、オンボーディング資料の構造化。
- メールマガジン HTML の前処理。
- 静的サイトジェネレータに投入する前の HTML fragment 生成。
- AI 生成 Markdown の出力標準化。

---

## 3. 開発方針

### 3.1 バージョン方針

md-hinagata は `0.x.x` 系として開発する。

```txt
0.1.0
  最小 MVP。思想が体験できる縦切り版。

0.1.x
  バグ修正、小改善、MVP 安定化。

0.2.0
  テーマ管理、validation、workspace theme、diagnostics 強化。

0.3.0 以降
  CLI、theme package、syntax highlight、preview inspector などを拡張。

1.0.0
  theme schema、frontmatter schema、template variables、CLI interface を安定化した正式版。
```

### 3.2 `0.x.x` における破壊的変更

`0.x.x` では破壊的変更を許容する。ただし、変更は minor version で行う。

```txt
patch version
  バグ修正のみ。
  theme schema / frontmatter schema の破壊的変更はしない。

minor version
  新機能追加。
  theme schema / frontmatter schema / template variables の変更を許容する。
  ただし可能な限り migration warning を出す。
```

### 3.3 ライセンス方針

md-hinagata は、コード、同梱テーマ、ユーザー作成テーマ、examples、生成 HTML でライセンスの扱いを分ける。

| 対象 | ライセンス方針 |
|---|---|
| Code | `MIT OR Apache-2.0` |
| Bundled themes | `MIT OR Apache-2.0` |
| User themes | Author-defined |
| Examples | まずは `MIT OR Apache-2.0`。将来 `CC0-1.0` も検討する。 |
| Generated HTML | tool license は生成 HTML の所有権を主張しない。 |

---

## 4. `0.1.0` MVP スコープ

### 4.1 `0.1.0` の目的

`0.1.0` は完成版ではなく、md-hinagata の核となる体験を証明するための MVP である。

`0.1.0` の成功条件は以下である。

```txt
VS Code で Markdown を開く
frontmatter で theme を指定する
左パネルに現在 theme と template 一覧が表示される
右パネルに theme 適用後の preview が表示される
Markdown 変更で preview が更新される
テンプレート保存で preview が更新される
生成 HTML をコピーできる
```

### 4.2 `0.1.0` に含める機能

#### VS Code 拡張

- VS Code extension として起動できる。
- Markdown ファイルを VS Code 標準エディタで編集できる。
- `Open Preview` コマンドで右側に Themed Preview を開ける。
- 左サイドバーに Theme Manager を表示できる。
- `Copy Generated HTML` コマンドで生成 HTML をコピーできる。
- `Select Theme` コマンドで現在の Markdown の frontmatter を更新できる。

#### Frontmatter

- `hinagata.theme` を読み取れる。
- `hinagata.output` を読み取れる。
- frontmatter がない場合は default theme を使う。
- theme が見つからない場合は default theme に fallback し、warning を出す。

#### Theme

- 組み込み `default` theme を持つ。
- workspace theme を `.md-hinagata/themes/{themeId}` から読み込める。
- theme は `theme.json`、`styles.css`、`templates/*.hbs` で構成する。
- テンプレートは Handlebars 形式を使う。

#### Transform Core

- Rust 製変換コアを使う。
- VS Code 拡張から WASM 経由で呼び出す。
- Markdown、theme package、options を受け取り、HTML、CSS、diagnostics を返す。
- VS Code の API やファイルシステムには依存しない。

#### Preview

- Webview でテーマ適用後の HTML を表示する。
- Markdown 編集時に debounce して再変換する。
- 使用中 theme の `theme.json`、`styles.css`、`templates/*.hbs` 保存時に再変換する。

#### Diagnostics

- Unknown theme。
- Missing template。
- Invalid frontmatter。
- Invalid theme manifest。
- Template render error。

### 4.3 `0.1.0` で対応する Markdown 要素

`0.1.0` では以下を対象にする。

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

最小実装では `h1`、`h2`、`p`、`codeblock` を先に実装し、その後 `blockquote`、`ul`、`ol`、`li` を追加する。

### 4.4 `0.1.0` で対応しないもの

以下は `0.1.0` では対象外とする。

- WYSIWYG 編集。
- CMS への直接投稿。
- サイト全体の生成。
- CLI。
- Tauri app。
- Web app。
- theme package import/export。
- `.hinagata-theme` または `.md-hinagata-theme` の配布形式。
- table 対応。
- image / link のテンプレート対応。
- 高度な syntax highlight。
- preview 要素クリックから template を開く機能。
- 左パネル内の本格コードエディタ。
- AI 補助機能。

---

## 5. Frontmatter 要件

### 5.1 基本形式

Markdown ファイルは frontmatter で使用 theme を指定する。

```md
---
hinagata:
  theme: default
  output: fragment
---

# Title

Body text.
```

### 5.2 `0.1.0` の frontmatter schema

| Key | Type | Default | Required | Description |
|---|---|---:|---:|---|
| `hinagata.theme` | string | `default` | no | 使用する theme ID。 |
| `hinagata.output` | string | `fragment` | no | 出力形式。`0.1.0` では実質 `fragment` のみ。 |

### 5.3 テーマ解決の優先順位

`0.1.0` では以下の順に解決する。

```txt
1. Markdown frontmatter の hinagata.theme
2. VS Code / workspace default theme
3. bundled default theme
```

theme ID の探索順は以下とする。

```txt
1. workspace/.md-hinagata/themes/{themeId}
2. bundled themes/{themeId}
```

`0.2.0` 以降で user theme paths を追加する。

### 5.4 Frontmatter 更新

`Select Theme` コマンドは、現在開いている Markdown の frontmatter を更新する。

frontmatter がない場合は、ファイル先頭に追加する。

```md
---
hinagata:
  theme: company-blog
  output: fragment
---

# Title
```

既存 frontmatter がある場合は、既存メタデータを保持したまま `hinagata.theme` を追加または更新する。

YAML が壊れている場合は、自動更新しない。warning を表示し、手動修正を促す。

---

## 6. Theme 要件

### 6.1 Theme の基本構造

開発中の theme はディレクトリ形式で管理する。

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

### 6.2 Theme manifest

`theme.json` は theme のメタデータと template mapping を定義する。

```json
{
  "$schema": "https://md-hinagata.dev/schemas/theme-0.1.schema.json",
  "schemaVersion": "0.1",
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

### 6.3 `0.1.0` の theme manifest schema

| Field | Type | Required | Description |
|---|---|---:|---|
| `$schema` | string | no | JSON Schema URL。 |
| `schemaVersion` | string | no | Theme schema version。`0.1` を想定。 |
| `id` | string | yes | Theme ID。directory name と一致することが望ましい。 |
| `name` | string | yes | 表示名。 |
| `version` | string | yes | Theme version。 |
| `entryCss` | string | no | Preview に適用する CSS path。 |
| `templates` | object | yes | Markdown 要素と template path の対応。 |

### 6.4 Template file

テンプレートには `.hbs` を使う。

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

### 6.5 Template variable rules

`0.1.0` では以下の基本ルールを採用する。

```txt
{{text}}
  HTML escaped plain text.

{{{inner_html}}}
  Markdown children から生成された HTML。

{{raw}}
  HTML escaped raw text。

{{lang}}
  codeblock の言語名。

{{id}}
  heading などの HTML id。

{{level}}
  heading level。
```

安全上の理由により、HTML として挿入できる変数は限定する。すべての値を `{{{ }}}` で出力する設計にはしない。

### 6.6 Template fallback

`0.1.0` では、template が存在しない場合は以下の挙動を取る。

```txt
1. warning を出す。
2. built-in fallback renderer で最低限の HTML を生成する。
```

例:

```txt
Missing template "blockquote" in theme "company-blog". Using fallback renderer.
```

---

## 7. VS Code 拡張要件

### 7.1 拡張の基本構成

```txt
VS Code standard Markdown editor
  +
Theme Manager sidebar
  +
Themed Preview webview panel
  +
Rust/WASM transform core
```

Markdown 本文の編集は VS Code 標準エディタに任せる。独自 Markdown エディタは作らない。

### 7.2 コマンド要件

`0.1.0` では以下のコマンドを提供する。

| Command title | Description |
|---|---|
| `md-hinagata: Open Preview` | 現在の Markdown の Themed Preview を開く。 |
| `md-hinagata: Copy Generated HTML` | 現在の生成 HTML fragment をコピーする。 |
| `md-hinagata: Select Theme` | 現在の Markdown の `hinagata.theme` を更新する。 |
| `md-hinagata: Open Current Theme` | 現在使用中の theme directory または `theme.json` を開く。 |
| `md-hinagata: Validate Current Theme` | 現在の theme を検証する。 |

### 7.3 Theme Manager sidebar

左パネルは Theme Manager / Inspector として使う。

`0.1.0` で表示する内容:

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

Diagnostics
  Unknown theme
  Missing template
  Invalid frontmatter
  Template render error

Actions
  Open Preview
  Copy Generated HTML
  Select Theme
  Validate Theme
```

Template item をクリックした場合、左パネル内で編集するのではなく、VS Code 標準エディタで該当 `.hbs` ファイルを開く。

### 7.4 Preview panel

右側の Preview は Webview Panel として表示する。

Preview は以下の場合に更新される。

- Markdown document が変更されたとき。
- Markdown document が保存されたとき。
- 使用中 theme の `theme.json` が保存されたとき。
- 使用中 theme の `styles.css` が保存されたとき。
- 使用中 theme の `templates/*.hbs` が保存されたとき。
- frontmatter の theme が変更されたとき。

### 7.5 Generated HTML

`0.1.0` では生成 HTML の表示パネルは任意とする。ただし、copy command は必須とする。

`0.2.0` 以降で `Open Generated HTML` panel を追加する。

---

## 8. Rust/WASM 変換コア要件

### 8.1 Rust core の責務

Rust core は以下を担当する。

- frontmatter の parse。
- Markdown 本文の parse。
- Theme manifest と template の受け取り。
- Markdown 要素ごとの template 適用。
- HTML fragment の生成。
- diagnostics の生成。

Rust core は以下を担当しない。

- VS Code API の呼び出し。
- workspace file system の探索。
- Webview の更新。
- frontmatter のファイル上の書き換え。

### 8.2 WASM API

`0.1.0` では JSON 入出力でよい。

```ts
type TransformRequest = {
  markdown: string;
  themes: ThemePackage[];
  defaultThemeId?: string;
  options?: TransformOptions;
};

type ThemePackage = {
  id: string;
  name: string;
  version: string;
  css?: string;
  templates: Record<string, string>;
};

type TransformOptions = {
  sanitize?: boolean;
  allowRawHtml?: boolean;
};

type TransformResponse = {
  html: string;
  css?: string;
  resolvedThemeId: string;
  diagnostics: Diagnostic[];
};

type Diagnostic = {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
};
```

### 8.3 Parser / Template engine

`0.1.0` の想定:

```txt
Markdown parser: comrak
Template engine: handlebars-rust
WASM bridge: wasm-bindgen
```

### 8.4 Performance

`0.1.0` の目標:

- 通常の Markdown document では編集から preview 更新までの体感遅延を小さくする。
- Preview 更新は debounce する。
- Theme template は毎回 parse しない方向を将来的に検討する。ただし `0.1.0` では実装優先でよい。
- 巨大文書の差分変換は `0.1.0` の対象外。

---

## 9. Security 要件

md-hinagata は Markdown、HTML、CSS、template を扱うため、セキュリティを明示的に設計する。

### 9.1 `0.1.0` の最低要件

- raw HTML は default off。
- Preview Webview に CSP を設定する。
- Webview の `enableScripts` は必要最小限にする。
- `localResourceRoots` を必要な resource directory に制限する。
- Workspace theme は trusted workspace のみで有効にする。
- Untrusted workspace では bundled theme のみを使用する。

### 9.2 Untrusted workspace での挙動

```txt
Allowed:
  bundled default theme
  preview
  copy generated HTML

Disabled:
  workspace theme loading
  custom template loading
  theme import
  raw HTML
```

### 9.3 Future security enhancements

`0.2.0` 以降で以下を検討する。

- sanitize policy の theme ごとの設定。
- CSS URL や外部 resource の warning。
- Theme package import 時の zip slip 対策。
- Template variable の unsafe usage warning。

---

## 10. Directory structure 要件

### 10.1 Repository structure

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
        panels/
        views/
        services/
        frontmatter/
        utils/
      media/
        preview/
        theme-editor/
      resources/

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

  docs/
    requirements.ja.md
    architecture.ja.md
    theme-format.ja.md
    frontmatter.ja.md
    security.ja.md
```

### 10.2 Workspace theme structure

```txt
project/
  docs/
    article.md

  .md-hinagata/
    themes/
      company-blog/
        theme.json
        styles.css
        templates/
          h1.hbs
          h2.hbs
          p.hbs
          codeblock.hbs
```

---

## 11. Diagnostics 要件

### 11.1 Diagnostic codes

`0.1.0` では以下を候補とする。

| Code | Severity | Description |
|---|---|---|
| `unknown-theme` | warning | 指定 theme が見つからない。 |
| `invalid-frontmatter` | error | frontmatter が parse できない。 |
| `unsupported-output` | warning | output mode が未対応。 |
| `invalid-theme-json` | error | `theme.json` が不正。 |
| `missing-template` | warning | 必要な template がない。 |
| `template-render-error` | error | template の render に失敗。 |
| `raw-html-disabled` | warning | raw HTML が無効化されている。 |

### 11.2 表示場所

`0.1.0` では以下に表示する。

- Theme Manager sidebar。
- Preview panel 内の warning area。

`0.2.0` 以降で VS Code Problems 連携を追加する。

---

## 12. Acceptance criteria for `0.1.0`

`0.1.0` は以下を満たしたら release 可能とする。

- [ ] VS Code で extension が起動する。
- [ ] Markdown ファイルで `md-hinagata: Open Preview` が実行できる。
- [ ] frontmatter の `hinagata.theme` を読み取れる。
- [ ] frontmatter がない場合、default theme で preview できる。
- [ ] bundled default theme で HTML fragment を生成できる。
- [ ] workspace theme を `.md-hinagata/themes/{themeId}` から読み込める。
- [ ] `h1`、`h2`、`h3`、`p`、`codeblock` を template で変換できる。
- [ ] `blockquote`、`ul`、`ol`、`li` を template または fallback で変換できる。
- [ ] 左 Theme Manager に current theme が表示される。
- [ ] 左 Theme Manager に template 一覧が表示される。
- [ ] template item をクリックすると VS Code 標準エディタで `.hbs` が開く。
- [ ] Markdown 編集時に preview が更新される。
- [ ] template 保存時に preview が更新される。
- [ ] `Copy Generated HTML` が HTML fragment を clipboard にコピーする。
- [ ] Unknown theme の warning が出る。
- [ ] Missing template の warning が出る。
- [ ] README の手順で basic example が動く。

---

## 13. Future roadmap

### 13.1 `0.2.0` candidate

- Theme validation 強化。
- VS Code Problems 連携。
- `Open Generated HTML` panel。
- `Create Theme from Default`。
- `Create Missing Template`。
- `Open theme.json` / `Open styles.css` の明確化。
- User theme paths。
- JSON Schema 補完。
- Workspace Trust 本対応。
- sanitize policy。
- link / image 対応。

### 13.2 `0.3.0` candidate

- CLI。
- CI validation。
- batch export。
- theme package import/export。
- `.hinagata-theme` または `.md-hinagata-theme` の配布形式。
- syntax highlight。

### 13.3 `0.4.0+` candidate

- Preview 要素クリックから template を開く。
- Template variable inspector。
- Markdown token inspector。
- Design system preset。
- Newsletter preset。
- Tauri standalone app。
- Web app。

---

## 14. Open questions

以下は `0.1.0` 実装中または `0.2.0` までに決める。

- `theme.json` の `schemaVersion` を必須にするか。
- Theme package の拡張子を `.hinagata-theme` と `.md-hinagata-theme` のどちらにするか。
- Template variable naming を snake_case に統一するか、camelCase を許容するか。
- `inner_html` を使う template に対する safety warning をどう設計するか。
- Preview に CSS をどの範囲で適用するか。
- Full HTML export を `0.2.0` に入れるか。
- `output: fragment` 以外の output mode をいつ追加するか。
- syntax highlight を Rust core 側で行うか、Preview 側で行うか。

---

## 15. Non-goals

md-hinagata は以下を目指さない。

- 高機能 Markdown プレビュー拡張になること。
- Typora や Obsidian のような Markdown エディタになること。
- Hugo、Astro、Docusaurus、MkDocs のような静的サイトジェネレータになること。
- Pandoc のような万能文書変換ツールになること。
- CMS のコンテンツ管理画面になること。
- WYSIWYG エディタになること。

md-hinagata の中心は、あくまで以下である。

```txt
Markdown block -> theme template -> controlled HTML fragment
```

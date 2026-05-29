# md-hinagata

[English](README.md) | [日本語](README.ja.md)

<div align="center">
  <img src="assets/logo/hinagata-logo.svg" alt="md-hinagata logo" width="200" />
</div>

<div align="center">

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/Shm11C3.md-hinagata-vscode-extension?label=VS%20Code%20Marketplace&logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=Shm11C3.md-hinagata-vscode-extension)

</div>

hinagata (md-hinagata) は高い自由度でテーマ変更が可能なMarkdown to HTML変換VSCode拡張です。

md-hinagataは、VS Code拡張機能とRust製の変換エンジンを組み合わせ、Markdownをテーマ制御されたHTMLへと変換します。「Markdownでコンテンツを書き、テーマを選び編集し、結果をプレビュー・生成されたHTMLをコピーする」といったワークフローを好むユーザー向けに設計されています。

https://github.com/user-attachments/assets/1ecaf17f-6629-4ef9-b44e-d71d5adefbf1

md-hinagataは単なるMarkdownビュワーではありません。その核心となる目的は、最終的なHTML構造を自在に制御することにあります。

```txt
Markdown + フロントマター + テーマテンプレート
  -> Rust変換コア
  -> 構造化されたHTMLフラグメント
  -> プレビュー / コピー / エクスポート
```

## ステータス

md-hinagataは現在、`0.x.x` 系として開発中です。

現在のVS Code拡張機能は `0.1.x` pre-release 系です。次のリリース目標は、VS Code Marketplaceで最初のstable releaseとなる `0.2.0` です。

実装済みの中心的な流れは以下です。

```txt
Markdownを記述
  -> フロントマターでテーマを選択
  -> 左サイドバーでテーマを検査
  -> VS Codeでテンプレートを編集
  -> テーマ適用済みのHTMLをプレビュー
  -> 生成されたHTMLをコピー
```

`0.x.x` の期間中は、テーマのスキーマ、フロントマターのスキーマ、テンプレート変数、およびRust APIに変更が加わる可能性があります。

## なぜ md-hinagata なのか？

ほとんどのMarkdownツールは、以下のいずれかの目標に焦点を当てています。

- Markdownをプレビューとしてレンダリングする。
- 静的サイト全体を生成する。
- CMSのコンテンツを管理する。
- Markdownを多くの出力形式に変換する。

md-hinagataは、より絞り込まれた課題に焦点を当てています。

> Markdownのブロックを、予測可能でテーマ制御されたHTMLコンポーネントに変換する。

例えば、次のようなMarkdownがあるとします。

```md
## Notice

This action cannot be undone.
```

選択されたテーマによって、以下のようなHTMLに変換されます。

```html
<h2 id="notice" class="article-heading article-heading--level2">Notice</h2>
<p class="article-body">This action cannot be undone.</p>
```

ここで言う「テーマ」とはCSSだけを指すのではありません。テンプレート、スタイル、メタデータ、そして出力ルールのパッケージを指します。

### 生成HTMLとCSS出力モード

`hinagata.output: fragment` はHTMLフラグメントを生成します。デフォルトでは、解決されたテーマが `entryCss` を持つ場合、生成HTMLには `<style>` タグとしてそのCSSが含まれ、その後にテーマ適用済みのdocument rootとMarkdown本文の変換結果が続きます。

Preview webviewは、`md-hinagata: Copy Generated HTML` がコピーする生成HTMLと同じHTMLを表示します。Preview専用の別経路でテーマCSSを適用することはしません。

`hinagata.cssMode` がテーマCSSの出力形式を制御します。この値はフロントマターの値を正とします。

| Mode        | Output                                                                        |
| ----------- | ----------------------------------------------------------------------------- |
| `style-tag` | テーマCSSを `<style>` タグとしてdocument rootの前に含めます。デフォルトです。 |
| `inline`    | 対応範囲内のテーマCSSを `style` 属性へ展開し、別CSSは返しません。             |
| `separate`  | document HTMLとCSSを分けて返します。                                          |
| `none`      | テーマCSSなしのdocument HTMLを返します。                                      |

## コア・アイディア

### テーマの選択はドキュメントに属する

Markdownファイルは、フロントマターを通じて自身のテーマを選択します。

```md
---
hinagata:
  theme: default
  output: fragment
---

# タイトル

本文。
```

これにより、出力の再現性が保たれます。ドキュメント自体が、自分がどのように変換されるべきかを知っている状態になります。

現在のドラフト版フロントマターJSON Schemaは [`schemas/frontmatter.schema.json`](schemas/frontmatter.schema.json) で管理します。VS Code拡張はMarkdown先頭のフロントマター内で `hinagata` key の補完を提供し、`hinagata.theme` の値候補には `md-hinagata: Select Theme` と同じ選択可能テーマを使います。

### テーマはテンプレートのパッケージである

テーマは、以下のようなディレクトリ構造を持ちます。

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

`theme.json` ファイルでテーマの定義を行います。

```json
{
  "$schema": "https://raw.githubusercontent.com/shm11C3/md-hinagata/main/schemas/theme.schema.json",
  "schemaVersion": "0.1",
  "id": "company-blog",
  "name": "Company Blog",
  "version": "1.0.0",
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

現在のドラフト版テーマJSON Schemaは [`schemas/theme.schema.json`](schemas/theme.schema.json) で管理します。

### テンプレートにはHandlebarsを使用

テンプレートには `.hbs` ファイル（Handlebars）を使用します。

例： `templates/h2.hbs`

```hbs
<h2 id="{{id}}" class="article-heading article-heading--level2">
  {{{inner_html}}}
</h2>
```

例： `templates/codeblock.hbs`

```hbs
<pre class="code-block"><code class="language-{{lang}}">{{raw}}</code></pre>
```

推奨される慣習：

```txt
{{text}}
  エスケープされたプレーンテキスト。

{{{inner_html}}}
  Markdownの子要素から生成されたHTML。

{{raw}}
  エスケープされた生のソーステキスト。
```

## 現在のスコープ

- VS Code拡張機能。
- 標準的なVS Code Markdownエディタ。
- `hinagata.theme` によるフロントマターベースのテーマ選択。
- 左サイドバーのテーママネージャー。
- 右サイドのテーマ適用済みプレビュー（Webview）。
- WASMにコンパイルされたRust製変換コア。
- Handlebarsベースのテーマテンプレート。
- 同梱の `default` テーマ。
- `.md-hinagata/themes/{themeId}` 下のワークスペーステーマ。
- `Create Theme from Default` コマンド。
- Markdown変更時のプレビュー更新。
- テーマファイル保存時のプレビュー更新。
- 生成されたHTMLのコピーコマンド。
- 未知のテーマや不足しているテンプレートに対する基本的な診断（Diagnostics）。
- `hinagata.cssMode` によるCSS出力モード。

サポートされるMarkdownブロック：

```txt
h1, h2, h3, p, codeblock, blockquote, ul, ol, li
```

含まれない機能：

- WYSIWYG編集。
- CLI。
- テーマパッケージのインポート/エクスポート。
- `.hinagata-theme` パッケージ。
- テーブル（表）のサポート。
- 画像およびリンクのテンプレートサポート。
- 高度なシンタックスハイライト。
- プレビュー要素からテンプレートへのジャンプ機能。
- 左サイドバーのコードエディタ。

## VS Codeでの体験

<img width="3594" height="2078" alt="image" src="https://github.com/user-attachments/assets/2258a287-06bf-4b5f-947a-107ec43322b8" />

左サイドバーはテーママネージャー兼インスペクターとして機能します。テンプレートファイルは通常のVS Codeエディタで開かれるため、編集、差分比較、検索、フォーマット、GitワークフローなどはVS Codeネイティブの機能がそのまま利用できます。

## テーマの解決順序

テーマの解決順序は以下です。

```txt
1. ワークスペース/.md-hinagata/themes/{themeId}（信頼されたワークスペースのみ）
2. 同梱テーマ/{themeId}
```

信頼されていないワークスペースでは、ワークスペーステーマの読み込みは無効になります。同梱テーマ、プレビュー、コピー機能は利用できます。

## リポジトリ構造

トップレベル構成：

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

  schemas/

  docs/
```

## 開発セットアップ

前提条件：

- Node.js 22 または 24（`pnpm` 10.x を使用）。
- Cargoを含むRustツールチェーン。
- WASMブリッジビルド用の `wasm-bindgen` CLI `0.2.121`。

JavaScriptワークスペースの依存関係をインストール：

```bash
pnpm install
```

Rustワークスペースを確認：

```bash
cargo check --workspace
```

拡張機能用のRustブリッジをビルドする際、WASMブリッジCLIをインストール：

```bash
cargo install wasm-bindgen-cli --version 0.2.121 --locked
```

現在のワークスペースのチェックを実行：

```bash
pnpm run check
pnpm run format
pnpm run lint
pnpm run test
```

`pnpm run format` はVS Code拡張機能とRustワークスペースの両方を整形します。`pnpm run lint` は拡張機能に対してBiomeを実行し、その後RustのフォーマットとClippyの警告を検証します。

VS Code拡張機能のバンドルをビルド：

```bash
pnpm run build
```

WASMブリッジをビルドし、生成されたモジュールをVS Code拡張機能にコピー：

```bash
pnpm run build:wasm
```

生成されたWASMファイルは `apps/vscode-extension/wasm/` に出力され、Gitコミットの対象にはなりません。

VS Code拡張機能ホストのE2Eスモークテストを実行：

```bash
pnpm run test:e2e
```

これにより、`examples/basic` を一時ワークスペースにコピーし、ローカルの拡張機能を含むVS Codeを起動し、コントリビュートされたコマンドを検証し、`sample.md` に対してプレビュー、HTMLコピー、`Create Theme from Default` を実行します。LinuxのCI環境では、このコマンドは `xvfb` 下で実行されます。

### 拡張機能開発ホスト

VS Codeでリポジトリのルートを開き、F5キーを押すか、「実行とデバッグ」から `Run md-hinagata Extension` を選択します。

この起動設定は `apps/vscode-extension` から拡張機能開発ホストを開始し、起動前に `md-hinagata: build extension` タスクを実行します。これにより、VSIXをパッケージ化することなく拡張機能バンドルをビルドします。

同梱のサンプルを使用してRust/WASMの変換パスを試すには、「実行とデバッグ」から `Run md-hinagata Extension (Basic Example)` を選択してください。これにより、`examples/basic` がワークスペースとして開かれ、`sample.md` が開かれます。起動前に `md-hinagata: prepare basic example` タスクが実行されるため、ワークスペーステーマ `.md-hinagata/themes/basic` が利用可能な状態になります。

拡張機能開発ホストでの確認手順：

1. 基本サンプルの起動設定を使用している場合、`sample.md` がアクティブであることを確認します。
2. `md-hinagata` アクティビティバーコンテナとテーママネージャービューが表示されていることを確認します。
3. コマンドパレットから `md-hinagata: Open Preview` を実行します。
4. テーマCSSを含む生成HTMLを `expected.html` と比較します。
5. コマンドパレットに `md-hinagata: Copy Generated HTML` と `md-hinagata: Select Theme` が表示されることを確認します。

## Rustコア

編集機能にはRustを使用していません。編集そのものはVS Codeが担います。

Rustは以下の変換エンジンに使用されます。

- Markdownおよびフロントマターのパース。
- テーマテンプレートのレンダリング。
- HTML生成。
- 診断（Diagnostics）。
- 将来的なCLIおよびCI統合。
- 将来的な一括エクスポート。

VS Code拡張機能はVS Code固有の処理を担当すべきであり、Rustコアはエディタに依存しない状態を維持すべきです。

```txt
VS Code拡張機能:
  ファイルを読み込む
  Webviewを管理する
  フロントマターを更新する
  ワークスペースパスを解決する

Rustコア:
  Markdownとテーマパッケージを受け取る
  HTMLを生成する
  診断結果を返す
```

## セキュリティモデル

md-hinagataはMarkdown、HTML、CSS、およびテンプレートを扱うため、セキュリティを考慮した設計になっています。

現在のデフォルト設定：

- 生のHTML（Raw HTML）はデフォルトで無効。
- ワークスペーステーマは信頼されたワークスペースでのみ許可。
- WebviewのCSP（コンテンツセキュリティポリシー）を必須化。
- Webviewのローカルリソースアクセスは拡張機能が管理するリソースに制限。
- プレビューHTMLは一般的なブラウザページではなく、VS Code Webview内で表示。

## ロードマップ

### 0.2.x

`0.2.0` stable releaseに向けた品質向上とテーマ作成体験の改善。

- CSS出力モードの安定化。
- テーマ検証と診断機能の改善。
- JSON Schema連携の改善。
- ワークスペーステーマ作成体験の改善。
- README、サンプル、Marketplaceメタデータの改善。

### 0.3.x

ツールとエクスポート。

- CLI。
- CIによる検証。
- 一括エクスポート。
- 生成されたHTMLを開く。
- 完全なHTMLエクスポート。
- テーブル（表）のサポート。

### 0.4.x 以降

- テーマパッケージのインポート/エクスポート。
- `.hinagata-theme` パッケージ形式。
- シンタックスハイライト。
- リンク、画像のサポート。
- プレビュー要素からテンプレートへのジャンプ。
- Desktopアプリ。

## ライセンス

md-hinagataは以下のいずれかを選択して利用できます。

- [MIT](./LICENSE-MIT)
- [Apache-2.0](./LICENSE-APACHE)

特に明記されていない限り、コード、同梱テーマ、examples は MIT OR Apache-2.0
の下で提供されます。ユーザーが作成したコンテンツおよび生成されたHTMLに対して、
ツールのライセンスは権利を主張しません。適用範囲の詳細は
[Licensing](./docs/licensing.md) を参照してください。

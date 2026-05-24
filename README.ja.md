# md-hinagata

[English](README.md) | [日本語](README.ja.md)

<div align="center">
  <img src="assets/logo/hinagata-logo.svg" alt="md-hinagata logo" width="200" />
</div>

高い自由度でテーマ変更が可能なMarkdown to HTML変換VSCode拡張です。

md-hinagataは、VS Code拡張機能とRust製の変換エンジンを組み合わせ、Markdownをテーマ制御されたHTMLへと変換します。「Markdownでコンテンツを書き、テーマを選び編集し、結果をプレビュー・生成されたHTMLをコピーする」といったワークフローを好むユーザー向けに設計されています。

md-hinagataは単なるMarkdownビュワーではありません。その核心となる目的は、最終的なHTML構造を自在に制御することにあります。

```txt
Markdown + フロントマター + テーマテンプレート
  -> Rust変換コア
  -> 構造化されたHTMLフラグメント
  -> プレビュー / コピー / エクスポート
```

## ステータス

md-hinagataは現在、`0.x.x` プロジェクトとして計画されています。

最初の目標は `0.1.0` です。これはコアとなる体験を実証するバーティカルスライスなMVP（実用最小限の製品）となります。

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
<h2 id="notice" class="article-heading article-heading--level2">
  Notice
</h2>
<p class="article-body">
  This action cannot be undone.
</p>
```

ここで言う「テーマ」とはCSSだけを指すのではありません。テンプレート、スタイル、メタデータ、そして出力ルールのパッケージを指します。

### MVPの出力契約

`0.1.0` では、`hinagata.output: fragment` は自己完結したHTMLフラグメントを生成します。解決されたテーマが `entryCss` を持つ場合、生成HTMLには `<style>` タグとしてそのCSSが含まれ、その後にテーマ適用済みのdocument rootとMarkdown本文の変換結果が続きます。

Preview webviewは、`md-hinagata: Copy Generated HTML` がコピーする生成HTMLと同じHTMLを表示します。Preview専用の別経路でテーマCSSを適用することはしません。

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

`0.1` のドラフトJSON Schemaは [`schemas/theme.schema.json`](schemas/theme.schema.json) で管理します。

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

## 計画中のMVP: v0.1.0

`0.1.0` MVPは、意図的に小規模に抑えられています。

### 0.1.0 に含まれる機能

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

初期サポートされるMarkdownブロック：

```txt
h1, h2, h3, p, codeblock, blockquote, ul, ol, li
```

### 0.1.0 に含まれない機能

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

想定されているレイアウト：

```txt
+----------------------+--------------------------+
| テーママネージャー      | テーマ適用済みプレビュー    |
|                      |                          |
| 現在のドキュメント      | Webviewでレンダリングされた |
| テーマ: company-blog  | 生成済みテーマ適用HTML     |
|                      |                          |
| テーマファイル         |                          |
| - theme.json         |                          |
| - styles.css         |                          |
|                      |                          |
| テンプレート          |                          |
| - h1.hbs             |                          |
| - h2.hbs             |                          |
| - p.hbs              |                          |
+----------------------+--------------------------+
| VS CodeのMarkdownエディタがソースエディタとして機能し続ける |
+---------------------------------------------------+
```

左サイドバーはテーママネージャー兼インスペクターとして機能します。テンプレートファイルは通常のVS Codeエディタで開かれるため、編集、差分比較、検索、フォーマット、GitワークフローなどはVS Codeネイティブの機能がそのまま利用できます。

## テーマの解決順序

`0.1.0` では、テーマの解決順序は以下のように計画されています。

```txt
1. ワークスペース/.md-hinagata/themes/{themeId}
2. 同梱テーマ/{themeId}
```

将来のバージョンでは、ユーザーレベルのテーマパスや、インポート可能なテーマパッケージが追加される可能性があります。

## リポジトリ構造

MVPに向けた計画構造：

（※ディレクトリ構造はソースコードの定義に従います。各ファイル・ディレクトリ名の翻訳は省略します）

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

VS Codeの編集機能にRustは使用していません。編集そのものはVS Codeが優れているためです。

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

計画されているデフォルト設定：

- 生のHTML（Raw HTML）はデフォルトで無効。
- ワークスペーステーマは信頼されたワークスペースでのみ許可。
- WebviewのCSP（コンテンツセキュリティポリシー）を必須化。
- Webviewのローカルリソースルートを制限。
- テーマパッケージのインポート時にファイルパスとファイルサイズを検証。
- 生成されたプレビューHTMLはサニタイズまたはサンドボックス化。

## ロードマップ

### 0.1.x

MVPの安定化。

- プレビュー更新の信頼性向上。
- 診断機能の改善。
- テーマファイルのウォッチ機能の改善。
- READMEとサンプルの改善。

### 0.2.x

テーマ作成体験の向上。

- デフォルトからテーマを作成。
- テーマの複製。
- 不足しているテンプレートの作成。
- テンプレート変数のインスペクター。
- テーマ検証の強化。
- JSON Schemaの統合。
- テーブル（表）のサポート。

### 0.3.x

ツールとエクスポート。

- CLI。
- CIによる検証。
- 一括エクスポート。
- 生成されたHTMLを開く。
- 完全なHTMLエクスポート。

### 0.4.x 以降

- テーマパッケージのインポート/エクスポート。
- `.hinagata-theme` パッケージ形式。
- シンタックスハイライト。
- リンク、画像のサポート。
- プレビュー要素からテンプレートへのジャンプ。
- Desktopアプリ。

## ライセンス

md-hinagataは MIT または Apache-2.0 ライセンスの下で提供されています。

ユーザーが作成したコンテンツおよび生成されたHTMLに対して、ツールのライセンスは権利を主張しません。
詳細は [LICENSE](./LICENSE) を参照してください。

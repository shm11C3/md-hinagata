# md-hinagata Release Procedure

> Target: VS Code Marketplace publishing for `0.x.x`

このドキュメントは、md-hinagata の VS Code Marketplace 公開手順を定義する。

Marketplace 公開は GitHub Actions の
`.github/workflows/publish-vscode-extension.yml` で行う。workflow は commit や tag を作らない。
公開する version は、事前に `apps/vscode-extension/package.json` に commit されている必要がある。

## 1. 基本方針

### 1.1 Marketplace 初回公開 version

最初の Marketplace pre-release は `0.1.0` とする。

最初の Marketplace stable release は `0.2.0` とする。

`0.0.x` は Marketplace には公開しない。

### 1.2 version format

`apps/vscode-extension/package.json` の `version` は常に以下の形式にする。

```txt
major.minor.patch
```

使用できる例:

```txt
0.1.0
0.1.1
0.2.0
0.2.1
0.3.0
0.3.1
```

使用しない例:

```txt
0.3.0-alpha.1
0.3.0-beta.1
0.3.0-pre.1
```

VS Code Marketplace の pre-release は SemVer prerelease suffix ではなく、
`vsce publish --pre-release` で公開する。

## 2. Stable / Pre-release Channel

channel は minor version の偶奇で決める。

| Channel | Minor version | Examples | Publish command |
|---|---:|---|---|
| stable | even | `0.2.0`, `0.2.1`, `0.4.0` | `pnpm exec vsce publish --no-dependencies --skip-duplicate` |
| pre-release | odd | `0.1.0`, `0.1.1`, `0.3.0`, `0.5.0` | `pnpm exec vsce publish --no-dependencies --skip-duplicate --pre-release` |

GitHub Actions workflow は `apps/vscode-extension/package.json` の `version` を読み取り、
minor が偶数なら stable、奇数なら pre-release として公開する。

この repository は pnpm workspace を使い、extension は publish 前に release build として bundle する。
そのため workflow は `vsce` の npm/yarn 依存検出を避けるために
`--no-dependencies` を付けて publish する。
Marketplace API の timeout 後に server side で公開が完了している可能性があるため、
workflow は `--skip-duplicate` も付け、短い retry を行う。
publish workflow は `apps/vscode-extension` の devDependencies に固定された
VSCE CLI を `pnpm exec vsce` で実行する。
release build は `pnpm run build:release` を使い、extension bundle を minify し、source map を同梱しない。

VS Code Marketplace 用の license file は repository root の
`LICENSE-MIT`、`LICENSE-APACHE` を source of truth とする。
同梱 theme も repository root の `themes/` を source of truth とする。
`apps/vscode-extension` 配下の同名 file と `themes/` は publish/package 直前に
`pnpm run prepare:vscode-extension-package` で同期する生成物であり、commit しない。

## 3. Tag Rule

tag は stable / pre-release ともに同じ形式で切る。

```txt
v<major>.<minor>.<patch>
```

例:

```txt
v0.2.0  -> stable
v0.2.1  -> stable patch
v0.1.0  -> pre-release
v0.1.1  -> pre-release patch
v0.3.0  -> pre-release
v0.3.1  -> pre-release patch
v0.4.0  -> stable
```

tag version は `apps/vscode-extension/package.json` の `version` と完全一致している必要がある。

例として、tag `v0.2.0` を push する場合:

```json
{
  "version": "0.2.0"
}
```

でなければ workflow は失敗する。

## 4. Prerequisites

Marketplace 公開前に以下を満たす。

- `apps/vscode-extension/package.json` に実際の `publisher` ID を設定する。
- GitHub Actions secret `VSCE_PAT` を設定する。
- `VSCE_PAT` は Marketplace Manage scope を持つ Personal Access Token にする。
- `apps/vscode-extension/package.json` の `version` を公開対象 version に更新して commit する。
- `version` に prerelease suffix を付けない。

publisher ID は Marketplace の publisher 作成後に確定する値を使う。
未確定のまま推測で設定しない。

## 5. Extension Changelog Automation

`apps/vscode-extension/CHANGELOG.md` は VS Code Marketplace に表示する
Extension Changelog である。

通常の feature / bug fix PR では `CHANGELOG.md` を直接更新しない。
Extension Changelog は、`apps/vscode-extension/package.json` の `version` を更新する
release preparation PR で自動生成する。

release preparation PR は以下を満たす。

- `apps/vscode-extension/package.json` の `version` を次の公開対象 version に更新する。
- PR に `area:release` と `changelog:skip` を付ける。
- fork から作成しない。

GitHub Actions の `Extension Changelog` workflow は、release preparation PR を検出すると、
前回の extension tag から release preparation PR の base branch までに merge された PR を集める。

前回 tag は、新しい version より小さい最大の `vX.Y.Z` tag とする。

```txt
new 0.1.1 -> previous v0.1.0
new 0.2.0 -> previous v0.1.1
new 0.2.1 -> previous v0.2.0
```

生成対象 PR の分類は GitHub labels を source of truth とする。

| Label | Changelog section |
|---|---|
| `area:security` | `Security` |
| `type:feature` | `Added` |
| `type:bug` | `Fixed` |
| `type:docs` | `Documentation` |
| `area:release` | `Maintenance` |
| `type:test` | `Maintenance` |
| `type:refactor` | `Maintenance` |

各 PR は、上記 category label をちょうど1つ持つか、明示的に `changelog:skip` を持つ。
category label がない PR、複数 category label を持つ PR、または `changelog:skip` と
category label を併用する PR は workflow で失敗する。

例外として、release preparation PR は `area:release` と `changelog:skip` の併用を許可する。
release preparation PR 自身は、その release の Extension Changelog には載せない。

生成される changelog item の文言は、まず PR body の1行 `Changelog: ...` を使う。
指定がない場合は PR title から conventional prefix を除いて生成する。
category は常に labels で決める。`Changelog: ...` は category を変更しない。

`changelog:skip` は、maintainer が確認する release-visible な判断である。
user-visible behavior change、bug fix、documented feature change、security relevant change には使わない。

`Extension Changelog` workflow は `pull_request_target` で動くが、trusted base branch の script だけを実行し、
fork PR では実行しない。PR branch は `CHANGELOG.md` の書き換え対象として checkout する。

## 6. Stable Release Procedure

例として `0.2.0` stable release を公開する場合:

1. `apps/vscode-extension/package.json` の `version` を `0.2.0` に更新する。
2. `publisher` など Marketplace metadata が設定済みであることを確認する。
3. 通常の PR で version 更新を review し、main に merge する。
4. main の最新 commit を取得する。

```bash
git switch main
git pull --ff-only
```

5. package version と同じ tag を作る。

```bash
git tag v0.2.0
git push origin v0.2.0
```

6. GitHub Actions の `Publish VS Code Extension` workflow が成功することを確認する。

stable patch release の場合も同じ手順で、minor は偶数のまま patch を上げる。

```txt
0.2.0 -> 0.2.1 -> 0.2.2
```

次の stable minor release は、次の偶数 minor を使う。

```txt
0.4.0
```

## 7. Pre-release Procedure

例として初回 `0.1.0` pre-release を公開する場合:

1. `apps/vscode-extension/package.json` の `version` を `0.1.0` に更新する。
2. `publisher` など Marketplace metadata が設定済みであることを確認する。
3. 通常の PR で version 更新を review し、main に merge する。
4. main の最新 commit を取得する。

```bash
git switch main
git pull --ff-only
```

5. package version と同じ tag を作る。

```bash
git tag v0.1.0
git push origin v0.1.0
```

6. GitHub Actions の `Publish VS Code Extension` workflow が
   `pnpm exec vsce publish --no-dependencies --pre-release` で公開することを確認する。

pre-release patch の場合も同じ手順で、minor は奇数のまま patch を上げる。

```txt
0.1.0 -> 0.1.1 -> 0.1.2
0.3.0 -> 0.3.1 -> 0.3.2
```

`0.2.x` stable の次の pre-release line は、次の奇数 minor を使う。

```txt
0.3.0
```

## 8. Manual Dispatch

`workflow_dispatch` でも publish workflow を起動できる。

ただし、実際の Marketplace 公開は tag push を基本とする。
manual dispatch は、指定 branch の `apps/vscode-extension/package.json` に commit 済みの
`version` をそのまま公開対象として扱う。

manual dispatch では tag と package version の照合ができないため、
通常リリースでは `vX.Y.Z` tag push を使う。

## 9. Failure Cases

workflow は主に以下の場合に失敗する。

- `version` が `major.minor.patch` ではない。
- `version` に `-alpha.1` などの prerelease suffix が付いている。
- tag version と package version が一致しない。
- `0.0.x` を Marketplace 公開しようとしている。
- `publisher` が未設定である。
- `VSCE_PAT` が未設定、期限切れ、または Marketplace Manage scope を持っていない。
- checks、tests、build、publish のいずれかが失敗した。
- VS Code Marketplace API が timeout し、workflow retry 後も完了確認できなかった。
- release preparation PR に必要な changelog labels がない、または矛盾している。
- release preparation PR が fork から作成されている。
- 公開対象 version と同じ tag が既に存在している。

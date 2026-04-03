# Pug Sniffer

クンクン嗅ぎ回って、Pugで指定したクラスのSCSS定義やmixin定義を探し当てるVS Code拡張です。

「この `.card__title`、どこで定義したっけ...？」
「この `+myMixin`、どのファイルで作ったっけ...？」

そんなとき、`pug-sniffer` は鼻を鳴らしながら候補を見つけに行きます。

## できること

- Pug/Jadeファイル上のクラス名から、対応するSCSS定義へジャンプ（定義へ移動）
- BEM記法をいい感じに追跡
	- フラット定義: `.block__element { ... }`
	- ネスト定義: `.block { &__element { ... } }`
- Pug/Jadeファイル上の `+mixinName` 呼び出しから、mixin定義へジャンプ
- `extends`/`include` のパスから、対象のPugファイルへジャンプ
	- `/` 始まりのパスは `src/` を基準に解決
	- 相対パス（`./`・`../`）は現在のファイルを基準に解決
	- `.pug` 拡張子は省略可
- SCSSおよびPugファイルの読み込みをキャッシュして、必要時だけ更新

## 使い方

### クラス → SCSS定義

1. Pug/Jadeファイルで `.class-name` のクラス名部分にカーソルを置く
2. 「定義へ移動」を実行
	 - 例: `F12`
	 - 例: `Cmd + クリック`（macOS）
3. 鼻が利けば、SCSS定義にジャンプします

### mixin → mixin定義

1. Pug/Jadeファイルで `+mixinName(...)` の `mixinName` 部分にカーソルを置く
2. 「定義へ移動」を実行
	 - 例: `F12`
	 - 例: `Cmd + クリック`（macOS）
3. 鼻が利けば、`mixin mixinName` が定義されているPugファイルの行にジャンプします

### extends/include → ファイルを開く

1. Pug/Jadeファイルで `extends パス` や `include パス` のパス部分にカーソルを置く
2. 「定義へ移動」を実行
	 - 例: `F12`
	 - 例: `Cmd + クリック`（macOS）
3. 鼻が利けば、対象のPugファイルを開きます

## 設定

この拡張は以下の設定を提供します。

- `pugSniffer.scssGlob`
	- 型: `string`
	- デフォルト: `src/assets/**/*.scss`
	- 説明: SCSSファイルを検索するglobパターン
- `pugSniffer.pugGlob`
	- 型: `string`
	- デフォルト: `src/**/*.pug`
	- 説明: mixin定義を探すPugファイルを検索するglobパターン

例:

```json
{
	"pugSniffer.scssGlob": "src/styles/**/*.scss",
	"pugSniffer.pugGlob": "src/views/**/*.pug"
}
```

## 注意点

- クラス抽出は、Pugのショートハンド記法（`.class-name`）向けです
- クラス名として認識するのは、カーソル位置の単語の直前が `.` の場合です
- mixin名として認識するのは、カーソル位置の単語の直前が `+` の場合です
- `extends`/`include` のパスで `/` 始まりのパスは `src/` を基準に解決します（例: `/templates/_base` → `src/templates/_base.pug`）
- プロジェクト構成によっては、`pugSniffer.scssGlob` や `pugSniffer.pugGlob` の調整が必要です

## 開発

```bash
npm install
npm run compile
```

監視モード:

```bash
npm run watch
```

## リリースノート

### 0.0.2

- `extends`/`include` のパスから対象Pugファイルへのジャンプを実装
	- `/` 始まりは `src/` 基準、相対パスは現在ファイル基準
	- `.pug` 拡張子省略に対応

### 0.0.1

- 初回リリース
- Pug/Jade上のクラスからSCSS定義検索を実装
- BEM（`__`）のフラット/ネスト探索に対応
- Pug/Jade上の `+mixinName` からmixin定義へのジャンプを実装

## ライセンス

このリポジトリのライセンス方針に従います。

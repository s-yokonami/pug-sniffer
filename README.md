# Pug Sniffer

クンクン嗅ぎ回って、Pugで指定したクラスのSCSS定義を探し当てるVS Code拡張です。

「この `.card__title`、どこで定義したっけ...？」

そんなとき、`pug-sniffer` は鼻を鳴らしながら候補を見つけに行きます。

## できること

- Pug/Jadeファイル上のクラス名から、対応するSCSS定義へジャンプ（定義へ移動）
- BEM記法をいい感じに追跡
	- フラット定義: `.block__element { ... }`
	- ネスト定義: `.block { &__element { ... } }`
- SCSS読み込みをキャッシュして、必要時だけ更新

## 使い方

1. Pug/Jadeファイルで `.class-name` のクラス名部分にカーソルを置く
2. 「定義へ移動」を実行
	 - 例: `F12`
	 - 例: `Cmd + クリック`（macOS）
3. 鼻が利けば、SCSS定義にジャンプします

## 設定

この拡張は以下の設定を提供します。

- `pugSniffer.scssGlob`
	- 型: `string`
	- デフォルト: `src/assets/**/*.scss`
	- 説明: SCSSファイルを検索するglobパターン

例:

```json
{
	"pugSniffer.scssGlob": "src/styles/**/*.scss"
}
```

## 注意点

- 現在のクラス抽出は、Pugのショートハンド記法（`.class-name`）向けです
- クラス名として認識するのは、カーソル位置の単語の直前が `.` の場合です
- プロジェクト構成によっては、`pugSniffer.scssGlob` の調整が必要です

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

### 0.0.1

- 初回リリース
- Pug/Jade上のクラスからSCSS定義検索を実装
- BEM（`__`）のフラット/ネスト探索に対応

## ライセンス

このリポジトリのライセンス方針に従います。

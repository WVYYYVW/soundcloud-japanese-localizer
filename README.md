# SoundCloud Japanese Localizer

> **非公式**の拡張機能です。SoundCloud Global Limited および関連会社とは関係ありません。
> "SoundCloud" は SoundCloud Global Limited の商標です。

[SoundCloud](https://soundcloud.com) の Web 版の画面（メニュー、ボタン、設定、ダイアログなど）を日本語で表示するブラウザ拡張機能です。

- **対応ブラウザ**: Chrome / Edge / Brave など Chromium 系（Manifest V3）、Firefox 140 以降（Android 版 Firefox 142 以降を含む）
- **翻訳方式**: 拡張機能に内蔵した辞書で置き換えます。外部の翻訳サービスには通信しません。
- **ユーザーが書いた文字は訳しません**: トラック名、ユーザー名、説明文、コメント、タグなどは原文のまま表示します。
- 収集するデータはありません。必要な権限は設定の保存（`storage`）と `soundcloud.com` へのアクセスだけです。

## インストール（開発版）

まずパッケージを作ります（Node.js 18 以降が必要）。

```sh
git clone https://github.com/WVYYYVW/soundcloud-japanese-localizer.git
cd soundcloud-japanese-localizer
npm install
npm run build
```

### Chrome / Edge / Brave

1. `chrome://extensions`（Edge は `edge://extensions`）を開きます。
2. 右上の「デベロッパー モード」をオンにします。
3. 「パッケージ化されていない拡張機能を読み込む」で `dist/chrome` フォルダを選びます。

### Firefox

1. `about:debugging#/runtime/this-firefox` を開きます。
2. 「一時的なアドオンを読み込む」で `dist/firefox/manifest.json` を選びます。

一時的なアドオンは Firefox を再起動すると外れます。常用するには、AMO（addons.mozilla.org）で署名済みの版を入れてください。

## 使い方

SoundCloud を開くと自動で日本語になります。ツールバーのアイコンから次の設定を切り替えられます。

| 設定 | 内容 |
| --- | --- |
| 日本語で表示する | オフにすると、ページを再読み込みせずに英語へ戻ります（再生は止まりません） |
| 未翻訳の文言をコンソールに出力 | 辞書にない英語の文言を開発者ツールのコンソールに出します。訳語の追加に使います |

## 訳語の追加・修正

訳語はすべて [`src/content/dictionary.js`](src/content/dictionary.js) にあります。

- `EXACT`: 文言全体が完全一致したときの訳（例: `"Follow": "フォロー"`）
- `PATTERNS`: 数字や名前を含む文言の正規表現（例: `3 days ago` → `3日前`）
- `CONTEXT`: 文の途中にリンクが挟まる箇所など、特定の要素の中だけで使う訳

未翻訳の文言を見つけるには、ポップアップで「未翻訳の文言をコンソールに出力」をオンにし、開発者ツールのコンソールで `[SoundCloud 日本語化] 未翻訳:` を確認してください。

訳の誤りや未翻訳の箇所は [Issues](https://github.com/WVYYYVW/soundcloud-japanese-localizer/issues) で報告するか、Pull Request を送ってください。

## 開発

```sh
npm test              # 翻訳エンジンのテスト（jsdom）
npm run build         # dist/chrome, dist/firefox と配布用 zip を作成
npm run lint:firefox  # Firefox 向けパッケージを web-ext で検証
npm run start:firefox # 拡張機能を入れた Firefox を起動
python3 scripts/make-icons.py  # アイコンを再生成（Pillow と日本語フォントが必要）
```

### 構成

```
src/
  manifest.json        共通の manifest（ビルド時にブラウザ別に調整）
  content/
    dictionary.js      訳語の辞書
    translator.js      翻訳エンジン（DOM のテキストと属性を置換、元に戻す処理も）
    main.js            起動処理と設定の反映、DOM の変化の監視
    style.css          日本語で折り返しが崩れる箇所の調整
  popup/               ツールバーのポップアップ
  _locales/            拡張機能名の多言語化（ja / en）
  icons/
scripts/
  build.mjs            ブラウザ別のパッケージ作成
  make-icons.py        アイコン生成
test/                  テスト
```

### 仕組み

SoundCloud はページ遷移しても画面全体を再読み込みしない作り（SPA）のため、`MutationObserver` で DOM の変化を監視し、追加・変更された文字と `title` / `aria-label` / `placeholder` 属性を辞書で置き換えます。置き換え前の文字は記録しておき、オフにしたときに元へ戻します。

## 既知の制限

- ログイン画面（`secure.soundcloud.com`）、Cookie 同意画面、埋め込みプレイヤー、SoundCloud for Artists は対象外です。
- SoundCloud 側の画面変更で、一部の文言が英語に戻ることがあります。見つけたら報告してください。

## ライセンス

[MIT](LICENSE)

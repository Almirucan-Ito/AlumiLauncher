# ミニアプリ・ウィジェットを作る(拡張の手引き)

利用者向けの説明は [README_JP.md](../README_JP.md)(英語は [README_EN.md](../README_EN.md))にあります。ここは、ミニアプリ・ウィジェットを**作る・追加する**人向けです。
ソースの中での置き場所と作り方(同梱する場合)は、[CONTRIBUTING.md](../CONTRIBUTING.md) と [architecture.md](architecture.md) を見てください。

## ウィジェット

### widgets フォルダの中身(組み込みのウィジェットの定義)

`%AppData%\AlumiLauncher\widgets\` には、組み込みのウィジェット(時計・よく使うもの・最近開いた・検索・ToDo・タイマー)の定義が、フォルダごとに入っています(`widgets\clock\widget.json` など)。`data_app` を書くと、データを共有するミニアプリを指定できます。**ミュージックのウィジェットの定義は、ミニアプリの中**(`miniapps\music\widgets\music\widget.json`)にあります。ミニアプリのウィジェットは、そのミニアプリの `widgets` フォルダに置きます(一覧の「フォルダ」ボタンも、そのフォルダを開きます)。ウィジェットの一覧は、このフォルダの中身から作られます。

```json
{
  "builtin": "clock",
  "name": "時計",
  "name_en": "Clock",
  "description": "時刻と日付",
  "description_en": "Time and date",
  "cells": [1, 7, 5]
}
```

- `builtin` … ランチャーが持つ実装の種類。これがあるウィジェットは、`index.html` を使わず、ランチャー内蔵の実装で動きます(音楽プレーヤー・起動の記録・保存データ・通知など、ランチャーの機能を直接使うため。画面を別に作る追加ウィジェットより、軽く動きます)
- `name` / `description` … 一覧に出る名前と説明。`name_en` / `description_en` は、英語表示のとき
- `cells` … `[最小, 最大, 標準]`(マスの数)。右クリックで変えられる幅の範囲と、最初に置いたときの幅を決めます。ヘッダー・フッターは、**横 7 マス**(最大は 7 まで)で、マスは**正方形**です。1 マスは **44px で固定**で、設定のアイコンの大きさでは変わりません(ウィンドウが狭くて、7 マスが収まらないときだけ縮みます)。**高さは、ウィジェットではなく、ヘッダー・フッターごと**に決まります(利用者が、ヘッダー(フッター)を右クリックして、小 = 1 マス・標準 = 2 マス・大 = 3 マスから選びます。初めは標準)。その段のウィジェットは、すべて、同じ高さです。ウィジェットの中身は、この高さに合わせて、切り替えてください。ランチャー内蔵の実装は、`.widget` が高さの入れ物(`container-type: size`)なので、CSS の `@container (max-height: 64px)`(1 マス)や `(min-height: 65px) and (max-height: 120px)`(2 マス)で、出すものを変えられます(例: `src/widgets/timer/view/style.css`)。追加ウィジェット(`index.html`)は、枠いっぱいの大きさで表示されるので、`window.innerHeight` などを見て、自分で切り替えます(`widget.json` の `height` は、いまは使いません)
- フォルダを消すと、そのウィジェットは一覧にも画面にも出なくなります。組み込みの定義は、アプリの更新で新しい版に変わったときだけ、書き出し直されます(消したものも戻ります)

### ウィジェットを自作・追加する(Mod)

`%AppData%\AlumiLauncher\widgets\<好きな名前>\` に、次の 2 つ以上のファイルを置くだけです(「ウィジェットの追加」画面の「追加ウィジェットのフォルダ」ボタンで開けます)。再起動は不要で、追加画面を開くたびに読み直します。

```
widgets\
  my-widget\
    widget.json   ← 名前・大きさ
    index.html    ← 中身(HTML / CSS / JavaScript。画像・CSS・JS を同じフォルダに置いてもOK)
```

`widget.json`(`name` 以外は省略できます):

```json
{
  "name": "表示する名前",
  "description": "追加画面に出る説明",
  "entry": "index.html",
  "width": 200,
  "height": 56
}
```

- フォルダ名は半角英数字と `- _ .` のみ(先頭のドットは不可)。幅は 60〜600px(省略時 160)、高さは 24〜200px(省略時 60)
- サンプル: このリポジトリの `src\widgets\_examples\year-progress` を、上の `widgets` フォルダへコピーしてください
- ランチャーから、文字色が `window.postMessage({ type: "alumi:theme", text: "rgb(...)", lang: "ja-JP" })` で届きます。使わなくても構いません

安全のため、追加ウィジェットは `sandbox` 付きの別画面(iframe)で動きます。**ランチャーの機能・設定・フォルダの中身・ファイルには触れません**。外部との通信は、`widget.json` / `miniapp.json` に `"network": true` と書いたものだけが対象で、初めて使うときに警告が出て、同意したあとだけ通信できます(書いていないものは、同意があっても通信できません。CSP の `connect-src`)。読み込めるのは、そのウィジェットのフォルダの中のファイルだけです。他の人が作ったウィジェットは、フォルダをコピーするだけで使えます。ただし、ウィジェットの中身(JavaScript)は誰でも書けるので、出所の分からないものは入れないでください。

## ミニアプリ

- 置き場所: `%AppData%\AlumiLauncher\miniapps\<好きな名前>\`(一覧の「フォルダ」ボタンで開けます)

```
miniapps\
  my-app\
    miniapp.json   ← 名前・アイコン・使う機能
    index.html     ← 中身(HTML / CSS / JavaScript)
    icon.svg       ← アイコン(任意。png / svg / jpg / webp / gif)
    widgets\       ← あれば、その中のウィジェットも「ウィジェットを追加」に出ます(任意)
      my-widget\widget.json, index.html
```

`miniapp.json`:

```json
{
  "name": "表示名",
  "name_en": "Display name",
  "description": "説明",
  "description_en": "Description",
  "entry": "index.html",
  "icon": "icon.svg",
  "permissions": ["saveText", "storage"]
}
```

`name_en` / `description_en` は、英語表示のとき(Windows の表示言語が日本語以外のとき)に使います(省略すると、`name` / `description` を使います)。

画面(`index.html`)の文言も、日本語と英語に対応できます。`navigator.language` で日本語かを調べて、文言を選びます(同梱のミニアプリは、先頭のファイルに `JA` と `L(日本語, 英語)` を置いています。HTML に直接書いた文言は、日本語のままにして、日本語以外のときだけ、JavaScript で英語に置き換えます。例: `src\miniapps\luckyrush\controller\main.js` の `localizeStatic`)。

JavaScript が大きくなったら、1 つのファイルに詰めず、`<script src="...">` を、続けて何本も書いて、役割ごとに分けられます(同梱の `luckyrush`・`timers`・`planner` が、その形です)。普通の `<script>` は、トップレベルの名前を共有するので、読み込む順番を守れば、分けても、動きは変わりません(`npm run check:js` も、同じミニアプリのファイルは、まとめて検査します)。

使える `permissions` は、`saveText` / `storage` / `player` / `files` / `launcher` / `images` / `alarm` です(知らないものは、無視されます)。

ミニアプリは sandbox 付きの別画面で動き、ランチャーの機能には直接触れません。使える機能は `permissions` に書いたものだけで、`window.parent.postMessage` で頼みます:

| method                                                                                                    | 必要な permissions | 内容                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `saveText` `{ title, content }`                                                                           | `saveText`         | ホームにテキストファイルを作る(結果は `{ name }`)                                                                                                                                                                                                                                                                                                                                         |
| `storage.get` `{ key }` / `storage.set` `{ key, value }`                                                  | `storage`          | このアプリ専用の保存領域(`miniapps\<名前>\data\<キー>.txt` に保存。1 キー 32KB・全体 60KB まで。キーは英数字と `_ - .` で 40 文字まで。`_` で始まるキーは、ランチャーだけが使います)                                                                                                                                                                                                      |
| `cache.get` `{ key }` / `cache.set` `{ key, value }`                                                      | `storage`          | 消えても困らない、作り直せるものの保存領域(`miniapps\<名前>\cache\<キー>.txt`)                                                                                                                                                                                                                                                                                                            |
| `player.state` / `player.cmd` `{ cmd, args }`                                                             | `player`           | 音楽プレーヤーの状態を読む・操作する(`play` `pause` `toggle` `next` `prev` `seek` `volume` `mute` `shuffle` `repeat` `rate` `remove` `move` `clear` `sleep` `addFiles` `addFolder` `list.new` `list.rename` `list.delete` `list.select` `copy`)。状態は、変わるたびに `{ alumi: 1, type: "player", state }` と `{ type: "player-tracks", tracks }` が届く。ミュージックと同じものを作れる |
| `home.texts` / `home.read` `{ path }` / `home.write` `{ path, content }`                                  | `files`            | ホームの `.txt` / `.md` の一覧・読み込み・上書き(すでにあるファイルだけ。2MB まで)                                                                                                                                                                                                                                                                                                        |
| `launcher.search` `{ q }` / `launcher.launch` `{ path }`                                                  | `launcher`         | ホームと登録したフォルダの中のアイコンを探す・起動する                                                                                                                                                                                                                                                                                                                                    |
| `images.pick` `{ mode: "folder" / "files" / "last" }`                                                     | `images`           | 画像を選ぶ。結果は `[{ name, url, thumb }]`(`<img src>` にそのまま使える)                                                                                                                                                                                                                                                                                                                 |
| `alarm.set` `{ id, at, label, kind, minutes }` / `alarm.cancel` `{ id }` / `alarm.list` / `alarm.collect` | `alarm`            | 時刻(`at` は UNIX ミリ秒)に、音と画面で知らせる。閉じている間に鳴ったものは、`alarm.collect` で、開いたときに受け取る。開いている間は `{ type: "alarm-fired", alarm }` が届く                                                                                                                                                                                                             |
| `toast` `{ message }`                                                                                     | なし               | 画面下に短いメッセージを出す                                                                                                                                                                                                                                                                                                                                                              |
| `close`                                                                                                   | なし               | ミニアプリを閉じてホームへ戻る                                                                                                                                                                                                                                                                                                                                                            |

```js
parent.postMessage({ alumi: 1, id: 1, method: "storage.get", params: { key: "n" } }, "*");
// 返事: window の message イベントに { alumi: 1, id: 1, ok: true, result: ... } が届く(失敗は ok: false, error)
// 読み込み時に { alumi: 1, type: "theme", text, bg, dim, field, stroke } も届く(色を合わせたいとき用)
```

### URL を開くミニアプリ(試験的な機能)

通常の利用では、想定していません。`miniapp.json` に `"url": "https://..."` を書くと(`index.html` は不要)、その URL を、別のウィンドウで開きます。**外部のサーバーと通信する**ので、初めて開くときに警告が出て、同意したあとだけ開けます(同意は、設定の「外部との通信を許可したもの」から取り消せます)。ウィンドウは、ランチャーの画面に重なり、ランチャーの動きに追従します。戻るのは、**Esc**、または画面の「閉じる」ボタンです。https 以外へは移動できません。ランチャーの機能には触れません(`permissions` も使えません)。スマホ表示にしたいときは `"mobile": true` を足します。同梱のミニアプリには、この形のものは、ありません(次の「ランチャーの外で作って、取り込む」のように、ランチャーの外で作って、取り込みます)。

サンプルは `src\miniapps\_examples\hello-app`(ウィジェットつき)と、メモ(`src\miniapps\memo`)です。`miniapps` フォルダにコピーすると使えます。アイコンにしたホームの `.alumiapp` は、ミニアプリを指す小さなファイルです。

組み込みのミニアプリ(メモ・ミュージック)は、アプリを更新したときに、新しい内容へ書き換わります(フォルダの `.alumi-bundled` が、書き出した版の印です)。自分用に変えたいときは、フォルダごと別の名前でコピーして使ってください。

## ウィジェットに、ホームのアイコン・フォルダを、ドラッグして落とせるようにする

ランチャー内蔵の実装(`builtin`)のウィジェットは、ホームのアイコン・フォルダを、ドラッグして落とされることができます(例: `src/widgets/shortcuts/`)。

1. ウィジェットの要素に、`data-drop-target="<名前>"` を付けます。
2. その要素で、`DROP_EVENT`(`"alumi:drop"`)のイベントを聞きます。`event.detail` は、`DropDetail`(`{ kind: "item", name, path }` か、`{ kind: "folder", id, name, path }`)です(どちらも `src/launcher/modules/plugins/PluginModel.ts`)。
3. ドラッグしている間、指が上に来た要素には、`data-drop-hover="true"` が付き、ランチャーが枠を描きます。

落とされたものは、ホームから無くなりません。ウィジェットは、参照(パス・ID)を、自分の `data` フォルダに保存して使います。追加ウィジェット(`index.html`)は、ランチャーとは別の画面で動くので、この仕組みは使えません。

## ランチャーの外のフォルダで作って、取り込む

ミニアプリは、ランチャーのソースの外のフォルダで作って、あとから取り込めます。ランチャーのソースは、触りません。

1. 好きな場所に、ミニアプリのフォルダを作ります(中に `miniapp.json` と、入口のファイル。`url` を書くものは、入口は要りません)。**フォルダ名が、取り込み先のフォルダ名(ID)になります**(使える文字は、英数字と `- _ .`)。
2. ランチャーのウィンドウへ、そのフォルダを**ドラッグ&ドロップ**します。`miniapps` フォルダへコピーされ(同じ名前があれば、置き換え = 更新)、「ミニアプリ…」の一覧に出ます。
3. 手でコピーしてもよいです。`%AppData%\AlumiLauncher\miniapps\<名前>\` に置くだけです(一覧の「フォルダの場所を開く」で開けます)。

取り込めるフォルダの上限は、ファイル 2000 個・合計 50MB・深さ 8 です。リンク(ショートカット)は辿りません。

`url` を書いた Web ミニアプリも、同じように取り込めます。

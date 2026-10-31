# modules/miniapps(ミニアプリの窓口)

ミニアプリ(ランチャーの中で、全画面のアプリとして動く HTML)を、開く・一覧を出す・ランチャーの機能を貸す・外部通信の同意を聞く、を受け持ちます。

## 担当すること

- **開く画面**: `miniapp.tsx`(`MiniAppHost`: sandbox 付きの `iframe` で動かす。`MiniEnv`: ランチャーが貸す機能の窓口)。
- **開く・一覧・貸す・同意**: `useMiniApps`(ミニアプリの一覧を読む、開く、`MiniEnv` の実装、外部との通信の同意)。
- **一覧の画面**: `MiniAppPicker`(`MiniAppIcon` も)。
- **アラーム**: `AlarmController`(ミニアプリが頼む、時刻の知らせを預かる)。
- **データ・キャッシュの大きさと消去**: `useStorageManagement`。
- **旧データの移行**: `MigrationController`(以前の保存場所の、ウィジェット・ミニアプリのデータを、それぞれのフォルダの `data` へ移す)。

## 担当しないこと

- ミニアプリのフォルダの読み取り・配信・同梱(Rust の `extensions/`)。
- 個々のミニアプリの中身(`src/miniapps/<名前>/`)。
- ミニアプリ固有の機能(例: 音楽プレーヤー)。それは、ミニアプリ側の `index.tsx` が `bridges` としてつなぐ(`modules/plugins`)。

## 設計の理由

- **ミニアプリは `iframe`(sandbox)で動かし、ランチャーの機能には、`postMessage` の窓口だけで触れさせる**。
  メッセージは `{ alumi: 1, id, method, params }`、返事は `{ alumi: 1, id, ok, result | error }`。
  このミニアプリの画面からのメッセージだけを受け付ける(`e.source` を確かめる)。
- **使える機能は、`miniapp.json` の `permissions` に書いたものだけ**: `miniapp.tsx` の `switch (method)` が、命令ごとに権限を確かめる。
  許可する権限の名前の元は `schemas/miniapp.schema.json`。**権限を足したら、スキーマと、`miniapp.tsx`(か、ミニアプリの `bridges`)の両方に足す**。
  足し忘れは `permissions.test.ts` が知らせる(スキーマにある権限が、どこかで処理されているかを確かめる)。
- **ミニアプリが保存できる値には、上限がある**(1 つ 32KB・合計 60KB。`_` で始まるキーは、ランチャー専用で、数えない・書き換えさせない)。
  キー名は、英数字と `_ - .` で 40 文字まで。
- **親の画面の CSS 変数は、別の画面(iframe)では使えない**ので、色は、いったん画面に置いて計算した実際の色(`resolveColor`)にして、ミニアプリへ渡す。
- **アラームは、ランチャー本体が持つ**(`AlarmController`): ミニアプリを閉じていても、時刻になれば、音と画面で知らせる。
  ミニアプリごとに分けて持ち、そのミニアプリの `data`(`_alarms`)に保存する。起動時に戻し、過ぎていたものは、知らせずに「知らせ済み」へ移す。
  同時に持てるのは 20 件、知らせ済みの記録は 100 件まで。
- **Web ミニアプリ(`url` を持つもの)は、`iframe` ではなく、別のウィンドウで開く**(Rust の `extensions/mini_web.rs`。位置合わせ・音量・閉じる)。
  外部のサイトを開くことは、作者は推奨していない(README に書いてある)。
- **外部と通信するミニアプリは、`"network": true` を宣言したものだけ**。初めて使うときに、利用者が同意する(`ConsentDialog`)。
  同意は、設定の `networkAllowed` に記録し、**Rust に届いてから**開く(先に開く要求が届くと、同意がまだ無いとして `not_allowed` で開けないため)。

## 触るときの注意

- 新しい命令を足すときは、`miniapp.tsx` の `switch` に、権限の確認つきで足す。
- `MiniEnv` に足した機能は、`useMiniApps` で実装する。
- 全体の図と、命令の一覧は `docs/architecture.md`。ミニアプリの作り方は `docs/extending.md`。

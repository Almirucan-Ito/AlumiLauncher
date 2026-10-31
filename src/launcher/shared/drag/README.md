# shared/drag(ドラッグの道具)

ドラッグ操作に使う、小さな道具です。

## 担当すること

- **`PickDragController`**(`usePickDrag`): ウィジェット・ミニアプリの追加画面の、行を掴んで、画面の好きな場所へドラッグして落とす。
  動かしている間は、一覧を透明にして(後ろが見えるように)、指に付いてくる小さな表示(ゴースト)を出す。6px 以上動いてから、ドラッグとして扱う。
- **`ShiftKeyController`**(`shiftDown`): Shift キーがいま押されているか。アイコンのドラッグ中に、Shift を押している間は、入れ替えや、フォルダへの出し入れをしない
  (`usePagerDrag`・`useDragHandover`・`FolderView` が使う)。Shift を押しただけでは、ポインタのイベントが来ないので、キーボードのイベントで記録しておく。

## 担当しないこと

- アイコンの並べ替え・フォルダへの出し入れのドラッグ(`shared/ui/usePagerDrag` と `modules/home/useDragHandover`)。
- 落とした先で何をするか(`onDrop` を渡す側が決める)。

## 設計の理由

- **ボタンの上から始めた操作は、ドラッグにしない**: 行の中のボタン(追加・消去など)が、普通に押せるように。
- **ドラッグの途中で一覧が閉じられても(Esc など)、「ドラッグ中」の状態を残さない**。ウィンドウのフォーカスが外れたときも、ドラッグを取り消す。
- **落とす場所の目印は、ランチャーが描く**(`data-drop-hover`)。ウィジェットは、`data-drop-target` と `alumi:drop` を使うだけでよい(`modules/plugins/PluginModel.ts`)。
- 見た目(`.pick-ghost`・`.modal.picking`)は、`shared/styles/widgets.css` にある。

# AlumiLauncher のインストーラーを作り、配布用のフォルダ(release/)にまとめる。
#   .\scripts\release.ps1             インストーラーを作る(ほとんどの場合はこれで十分)
#   .\scripts\release.ps1 -Zip        そのうえで、インストール不要で動かせる zip(ポータブル版)も作る(毎回は不要)
#   .\scripts\release.ps1 -Offline    オフライン版も作る(WebView2 を同梱するので約210MBになる)
#
# 作るもの:
#   AlumiLauncher_Setup.exe          通常版。WebView2 が無い PC でだけ、インストール時に Microsoft から取得する
#   AlumiLauncher_Portable.zip       ポータブル版(解凍すれば、そのまま使える。データは、フォルダ内の data に保存)。-Zip のとき
#   AlumiLauncher_Setup_Offline.exe  オフライン版(-Offline のとき)。WebView2 を同梱しているので、インストール中も通信しない
#   SHA256SUMS.txt                   ファイルの改ざん・破損を確認するためのチェックサム
#
# コード署名について: 証明書を用意できたら、src-tauri/tauri.conf.json の bundle.windows に
#   "certificateThumbprint": "<証明書の拇印>", "digestAlgorithm": "sha256", "timestampUrl": "<タイムスタンプ局のURL>"
# (または "signCommand")を設定してからこのスクリプトを実行すると、インストーラーと exe が署名されます。
# 署名が無いと、初回実行時に Windows SmartScreen の警告が出ます(README を参照)。
param([switch]$Offline, [switch]$Zip)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$nsis = Join-Path $root "src-tauri\target\release\bundle\nsis"
$exe = Join-Path $root "src-tauri\target\release\AlumiLauncher.exe"
$out = Join-Path $root "release"
$stage = Join-Path $root "release\.stage"
New-Item -ItemType Directory -Force $out | Out-Null
Get-ChildItem $out -Filter "*.exe" -ErrorAction SilentlyContinue | Remove-Item -Force  # 古いものが混ざらないように
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $stage | Out-Null

function Get-Installer {
  Get-ChildItem $nsis -Filter "*-setup.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

# 1 つの版をビルドして、インストーラー(と、zip 用の exe)を取っておく
function Build-Variant([string]$label, [string[]]$extra, [string]$installerName, [string]$portableName) {
  Write-Host "== $label をビルド =="
  npm run tauri build -- @extra
  if ($LASTEXITCODE -ne 0) { throw "$label build failed" }
  Copy-Item (Get-Installer).FullName (Join-Path $out $installerName) -Force
  if ($portableName) { Copy-Item $exe (Join-Path $stage $portableName) -Force }
}

Build-Variant "通常版" @() "AlumiLauncher_Setup.exe" "AlumiLauncher_normal.exe"

if ($Offline) {
  Write-Host "== オフライン版をビルド(WebView2 を同梱) =="
  npm run tauri build -- --config src-tauri/tauri.offline.conf.json
  if ($LASTEXITCODE -ne 0) { throw "offline build failed" }
  Copy-Item (Get-Installer).FullName (Join-Path $out "AlumiLauncher_Setup_Offline.exe") -Force
}

if ($Zip) {
  Write-Host "== ポータブル版(zip)を作る =="
  $readme = @"
AlumiLauncher ポータブル版(インストール不要)

この AlumiLauncher フォルダを、好きな場所に置いて、AlumiLauncher.exe をダブルクリックすると使えます。
・設定・ホームのアイコン・ミニアプリ・ウィジェットなどのデータは、すべて、この中の data フォルダに保存されます
  (PC のほかの場所には、何も書き込みません。フォルダごと別の場所や別の PC へ移せます。消すときは、フォルダを削除するだけです)。
・portable.txt は、ポータブル版の目印です。削除すると、インストール版と同じ %AppData%\AlumiLauncher を使います。
・Microsoft Edge WebView2 ランタイムが必要です(Windows 11 には最初から入っています)。
・インストール版を同時には起動できません(どちらか一方だけ)。
・初回起動時に Windows SmartScreen の警告が出たら、「詳細情報」→「実行」を選んでください(コード署名をしていないためです)。
"@
  $app = Join-Path $stage "pkg\AlumiLauncher"
  New-Item -ItemType Directory -Force $app | Out-Null
  Copy-Item (Join-Path $stage "AlumiLauncher_normal.exe") (Join-Path $app "AlumiLauncher.exe") -Force
  [IO.File]::WriteAllText((Join-Path $app "はじめにお読みください.txt"), $readme, (New-Object Text.UTF8Encoding $true))
  Copy-Item (Join-Path $root "LICENSE") (Join-Path $app "LICENSE.txt") -Force
  Copy-Item (Join-Path $root "THIRD_PARTY_LICENSES.md") (Join-Path $app "THIRD_PARTY_LICENSES.md") -Force
  [IO.File]::WriteAllText((Join-Path $app "portable.txt"), "ポータブル版の目印です。削除しないでください。", (New-Object Text.UTF8Encoding $true))
  $zipPath = Join-Path $out "AlumiLauncher_Portable.zip"
  Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
  Compress-Archive -Path $app -DestinationPath $zipPath -CompressionLevel Optimal
}
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "== チェックサム =="
$sums = Get-ChildItem $out -File | Where-Object { $_.Extension -in ".exe", ".zip" } | ForEach-Object {
  "{0}  {1}" -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower(), $_.Name
}
$sums | Set-Content (Join-Path $out "SHA256SUMS.txt") -Encoding ascii
$sums
Write-Host "完了: $out"

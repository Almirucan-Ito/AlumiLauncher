# インストーラーの画像(src-tauri\installer\sidebar.bmp・header.bmp)を作り直す。使い方: powershell -NoProfile -File scripts\make-installer-images.ps1
# 元の絵は src-tauri\installer\icon-source.png。画像は、画面が高解像度でもぼやけないよう、表示サイズの 3 倍で作る(NSIS が枠に合わせて縮める)
param(
  [string]$SrcPath = (Join-Path $PSScriptRoot '..\src-tauri\installer\icon-source.png'),
  [string]$Out = (Join-Path $PSScriptRoot '..\src-tauri\installer'),
  [string]$Preview = ''
)
Add-Type -AssemblyName System.Drawing
$S = 3
# 文字は、Noto Sans JP(SIL Open Font License 1.1 = 画像に使うのも、配るのも自由)で描く。Windows 付属のフォントは使わない(ライセンスの確認を、省くため)
# フォントが入っていないと、黙って別のフォントになってしまうので、先に調べる
$FontName = 'Noto Sans JP'
if (-not ((New-Object System.Drawing.Text.InstalledFontCollection).Families | Where-Object { $_.Name -eq $FontName })) {
  throw "フォント '$FontName' が入っていません(https://fonts.google.com/noto/specimen/Noto+Sans+JP から入れられます)"
}
function C($hex, $a = 255) { $c = [System.Drawing.ColorTranslator]::FromHtml($hex); [System.Drawing.Color]::FromArgb($a, $c.R, $c.G, $c.B) }
function Round($x, $y, $w, $h, $r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90); $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure(); return $p
}
function NewCanvas($w, $h) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode = 'HighQuality'; $g.TextRenderingHint = 'AntiAliasGridFit'
  return @($bmp, $g)
}
function Glow($g, $cx, $cy, $rx, $ry, $hex, $alpha) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddEllipse($cx - $rx, $cy - $ry, $rx * 2, $ry * 2)
  $br = New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
  $br.CenterColor = C $hex $alpha
  $br.SurroundColors = @(C $hex 0)
  $g.FillPath($br, $path)
}
function Background($g, $w, $h, $angle) {
  $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
  $br = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, (C '#6b6ff2'), (C '#1b1457'), $angle)
  $blend = New-Object System.Drawing.Drawing2D.ColorBlend(3)
  $blend.Colors = @((C '#7a7dff'), (C '#4f46d8'), (C '#1a1352'))
  $blend.Positions = @(0.0, 0.5, 1.0)
  $br.InterpolationColors = $blend
  $g.FillRectangle($br, $rect)
}
function Icon($g, $img, $x, $y, $size) {
  # やわらかい影
  for ($i = 14; $i -ge 1; $i--) {
    $grow = $i * 2 * $S / 3
    $p = Round ($x - $grow) ($y - $grow + 14 * $S / 3) ($size + $grow * 2) ($size + $grow * 2) ($size * 0.26 + $grow)
    $g.FillPath((New-Object System.Drawing.SolidBrush((C '#0a0630' 5))), $p)
  }
  $g.DrawImage($img, $x, $y, $size, $size)
}
$src = [System.Drawing.Image]::FromFile($SrcPath)

# ---------- サイドバー ----------
# 日本語のダイアログは、文字の基準の大きさが違い、枠が横に約 20% 広くなる(実機の画面で、164:314 の画像が横に伸びた)。伸びないよう、枠と同じ縦横比(約 0.63)で作る
$w = 197 * $S; $h = 314 * $S
$cv = NewCanvas $w $h; $bmp = $cv[0]; $g = $cv[1]
Background $g $w $h 62
Glow $g ($w * 0.95) ($h * 0.05) ($w * 0.9) ($w * 0.9) '#c9ccff' 120
$isz = 86 * $S
Icon $g $src (($w - $isz) / 2) (70 * $S) $isz
$f = New-Object System.Drawing.StringFormat; $f.Alignment = 'Center'; $f.LineAlignment = 'Center'
$font = New-Object System.Drawing.Font($FontName, [single](19 * $S), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString('AlumiLauncher', $font, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF(0, (190 * $S), $w, (26 * $S))), $f)
$bmp.Save((Join-Path $Out 'sidebar.bmp'), [System.Drawing.Imaging.ImageFormat]::Bmp)
if ($Preview) { $bmp.Save((Join-Path $Preview 'sidebar.png'), [System.Drawing.Imaging.ImageFormat]::Png) }
$g.Dispose(); $bmp.Dispose()

# ---------- ヘッダー(表示 150×57) ----------
$w = 150 * $S; $h = 57 * $S
$cv = NewCanvas $w $h; $bmp = $cv[0]; $g = $cv[1]
Background $g $w $h 20
Glow $g ($w * 0.9) ($h * 0.1) ($w * 0.6) ($w * 0.6) '#c9ccff' 110
Glow $g ($w * 0.0) ($h * 1.1) ($w * 0.5) ($w * 0.5) '#d26cff' 90
$isz = 38 * $S
$g.DrawImage($src, 12 * $S, ($h - $isz) / 2, $isz, $isz)
$f2 = New-Object System.Drawing.StringFormat; $f2.Alignment = 'Near'; $f2.LineAlignment = 'Center'
$font3 = New-Object System.Drawing.Font($FontName, [single](10.8 * $S), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString('AlumiLauncher', $font3, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF((56 * $S), (20 * $S), (94 * $S), (18 * $S))), $f2)
$bmp.Save((Join-Path $Out 'header.bmp'), [System.Drawing.Imaging.ImageFormat]::Bmp)
if ($Preview) { $bmp.Save((Join-Path $Preview 'header.png'), [System.Drawing.Imaging.ImageFormat]::Png) }
$g.Dispose(); $bmp.Dispose(); $src.Dispose()
"ok"



# アプリのアイコン(モダン・インディゴ)の元画像 1024x1024 を描く。
#   .\scripts\make-icon.ps1            → src-tauri\installer\icon-source.png
# そのあと `npx tauri icon src-tauri\installer\icon-source.png` で、各サイズの png / ico を作る(Windows 専用なので、使わない macOS 用の icns、ストア用の Square*Logo.png・StoreLogo.png、64x64.png、128x128@2x.png は、できても消す。使うのは、tauri.conf.json の bundle.icon の 3 つと、icon.png)。インストーラーの画像は、scripts\make-installer-images.ps1 で作る(別のスクリプト)。
Add-Type -AssemblyName System.Drawing
$S = 1024
$k = $S / 200.0

function Col($a, $hex) {
  $h = $hex.TrimStart('#'); [System.Drawing.Color]::FromArgb($a, [Convert]::ToInt32($h.Substring(0,2),16), [Convert]::ToInt32($h.Substring(2,2),16), [Convert]::ToInt32($h.Substring(4,2),16))
}
function RoundRect($x, $y, $w, $h, $r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = 2 * $r
  $p.AddArc($x, $y, $d, $d, 180, 90); $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure(); $p
}
function Diag($x, $y, $w, $h, $c1, $c2) {
  # 左上 → 右下のグラデーション(SVG の objectBoundingBox と同じ向き)
  New-Object System.Drawing.Drawing2D.LinearGradientBrush ((New-Object System.Drawing.PointF($x, $y)), (New-Object System.Drawing.PointF(($x + $w), ($y + $h))), $c1, $c2)
}

$bmp = New-Object System.Drawing.Bitmap $S, $S, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.PixelOffsetMode = 'HighQuality'; $g.Clear([System.Drawing.Color]::Transparent)

# 背景(インディゴ → 淡い紫)と、上側のハイライト
$bx = 6 * $k; $bw = 188 * $k; $br = 46 * $k
$path = RoundRect $bx $bx $bw $bw $br
$g.FillPath((Diag $bx $bx $bw $bw (Col 255 '#5B63F0') (Col 255 '#8E7BFF')), $path)
$hl = New-Object System.Drawing.Drawing2D.LinearGradientBrush ((New-Object System.Drawing.PointF(0, $bx)), (New-Object System.Drawing.PointF(0, ($bx + $bw))), (Col 64 '#FFFFFF'), (Col 0 '#FFFFFF'))
$blend = New-Object System.Drawing.Drawing2D.ColorBlend 3
$blend.Colors = @((Col 64 '#FFFFFF'), (Col 0 '#FFFFFF'), (Col 0 '#FFFFFF')); $blend.Positions = @(0.0, 0.5, 1.0)
$hl.InterpolationColors = $blend
$g.FillPath($hl, $path)

# 3x3 のタイル。左上だけ白 → 淡い水色のグラデーション、ほかは半透明の白い板
$pos = 34, 82, 130
foreach ($row in 0..2) { foreach ($col in 0..2) {
  $x = $pos[$col] * $k; $y = $pos[$row] * $k; $s = 36 * $k; $r = 11 * $k
  if ($row -eq 0 -and $col -eq 0) {
    $g.FillPath((Diag $x $y $s $s (Col 255 '#FFFFFF') (Col 255 '#CFE4FF')), (RoundRect $x $y $s $s $r))
  } else {
    $x2 = $x + 0.5 * $k; $y2 = $y + 0.5 * $k; $s2 = 35 * $k
    $tp = RoundRect $x2 $y2 $s2 $s2 $r
    $g.FillPath((Diag $x2 $y2 $s2 $s2 (Col 128 '#FFFFFF') (Col 56 '#FFFFFF')), $tp)
    $g.DrawPath((New-Object System.Drawing.Pen ((Col 140 '#FFFFFF'), $k)), $tp)
  }
} }

$out = Join-Path (Split-Path -Parent $PSScriptRoot) 'src-tauri\installer\icon-source.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
"saved $out"

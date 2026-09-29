Add-Type -AssemblyName System.Drawing
$target = Join-Path $PSScriptRoot '../packages/site-landing/install-icons'
foreach ($item in @(@(192,'ats-simbox-192.png'),@(512,'ats-simbox-512.png'),@(180,'ats-simbox-apple.png'))) {
  $size = [int]$item[0]
  $bitmap = New-Object System.Drawing.Bitmap($size,$size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.ScaleTransform($size/512.0,$size/512.0)
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush([System.Drawing.Point]::new(0,0),[System.Drawing.Point]::new(512,512),[System.Drawing.ColorTranslator]::FromHtml('#126577'),[System.Drawing.ColorTranslator]::FromHtml('#073842'))
  $graphics.FillRectangle($bg,0,0,512,512)
  $ring = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#44939C'),4)
  $graphics.DrawEllipse($ring,124,124,264,264)
  $graphics.DrawEllipse($ring,172,172,168,168)
  $box = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#DDF1F0'),9)
  $box.StartCap = $box.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  foreach ($points in @(@(166,108,126,108,126,148),@(346,108,386,108,386,148),@(126,364,126,404,166,404),@(386,364,386,404,346,404))) {
    $graphics.DrawLines($box,[System.Drawing.PointF[]]@([System.Drawing.PointF]::new($points[0],$points[1]),[System.Drawing.PointF]::new($points[2],$points[3]),[System.Drawing.PointF]::new($points[4],$points[5])))
  }
  $plane = [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(256,153),[System.Drawing.PointF]::new(270,173),[System.Drawing.PointF]::new(274,238),[System.Drawing.PointF]::new(343,286),[System.Drawing.PointF]::new(343,307),[System.Drawing.PointF]::new(273,281),[System.Drawing.PointF]::new(270,332),[System.Drawing.PointF]::new(294,350),[System.Drawing.PointF]::new(294,365),[System.Drawing.PointF]::new(256,354),[System.Drawing.PointF]::new(218,365),[System.Drawing.PointF]::new(218,350),[System.Drawing.PointF]::new(242,332),[System.Drawing.PointF]::new(239,281),[System.Drawing.PointF]::new(169,307),[System.Drawing.PointF]::new(169,286),[System.Drawing.PointF]::new(238,238),[System.Drawing.PointF]::new(242,173))
  $white = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#F4FBFA'))
  $gold = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#FFBA59'))
  $graphics.FillPolygon($white,$plane)
  $graphics.FillEllipse($gold,327,167,20,20)
  $bitmap.Save((Join-Path $target $item[1]),[System.Drawing.Imaging.ImageFormat]::Png)
  $gold.Dispose(); $white.Dispose(); $box.Dispose(); $ring.Dispose(); $bg.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}

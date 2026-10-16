# The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
# Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
# The Original Code is ATS SIM BOX.
# The Original Developer is the Initial Developer.
# The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
# Contributor(s): None designated in this initial notice.
# No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.

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

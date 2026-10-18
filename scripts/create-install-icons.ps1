# The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
# Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
# The Original Code is ATS SIM BOX.
# The Original Developer is the Initial Developer.
# The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
# Contributor(s): None designated in this initial notice.
# No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$sourcePath = Join-Path $repositoryRoot 'packages/qgh-engine/ats-simbox-logo.png'
$installRoot = Join-Path $repositoryRoot 'packages/site-landing/install-icons'
$webIconRoot = Join-Path $repositoryRoot 'apps/web/static/icons'

function Save-ApprovedIcon {
  param([System.Drawing.Image]$Artwork, [int]$Size, [string]$Destination, [switch]$Maskable)

  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb))
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $attributes = New-Object System.Drawing.Imaging.ImageAttributes
  try {
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#05243A'))
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $attributes.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)

    # Keep the complete approved artwork; the maskable variant fits its full
    # rectangle inside the central safe circle, whose diameter is 80% of Size.
    $contentSize = if ($Maskable) { [int][Math]::Floor($Size * 0.8 / [Math]::Sqrt(2)) } else { $Size }
    $scale = [Math]::Min($contentSize / [double]$Artwork.Width, $contentSize / [double]$Artwork.Height)
    $width = [int][Math]::Floor($Artwork.Width * $scale)
    $height = [int][Math]::Floor($Artwork.Height * $scale)
    $left = [int][Math]::Floor(($Size - $width) / 2.0)
    $top = [int][Math]::Floor(($Size - $height) / 2.0)
    $rectangle = [System.Drawing.Rectangle]::new($left, $top, $width, $height)
    $graphics.DrawImage($Artwork, $rectangle, 0, 0, $Artwork.Width, $Artwork.Height, [System.Drawing.GraphicsUnit]::Pixel, $attributes)
    $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $attributes.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

$artwork = [System.Drawing.Image]::FromFile($sourcePath)
try {
  foreach ($item in @(@(192, 'ats-simbox-192.png'), @(512, 'ats-simbox-512.png'), @(180, 'ats-simbox-apple.png'))) {
    Save-ApprovedIcon -Artwork $artwork -Size ([int]$item[0]) -Destination (Join-Path $installRoot $item[1])
  }
  Save-ApprovedIcon -Artwork $artwork -Size 512 -Destination (Join-Path $installRoot 'ats-simbox-maskable-512.png') -Maskable
  Save-ApprovedIcon -Artwork $artwork -Size 512 -Destination (Join-Path $webIconRoot 'icon-maskable-512.png') -Maskable
  foreach ($item in @(@(192, 'icon-192.png'), @(512, 'icon-512.png'), @(180, 'apple-touch-icon.png'), @(32, 'favicon-32.png'))) {
    Save-ApprovedIcon -Artwork $artwork -Size ([int]$item[0]) -Destination (Join-Path $webIconRoot $item[1])
  }
} finally {
  $artwork.Dispose()
}

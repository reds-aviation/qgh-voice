param(
  [Parameter(Mandatory=$true)][string]$PlanPath,
  [Parameter(Mandatory=$true)][string]$AudioDirectory
)
$ErrorActionPreference = 'Stop'
$plan = Get-Content -LiteralPath $PlanPath -Raw | ConvertFrom-Json
$audioRoot = [System.IO.Path]::GetFullPath($AudioDirectory)
[System.IO.Directory]::CreateDirectory($audioRoot) | Out-Null
$speaker = New-Object -ComObject SAPI.SpVoice
$chosen = @($speaker.GetVoices() | Where-Object { $_.GetDescription() -match 'David' })
if ($chosen.Count -gt 0) { $speaker.Voice = $chosen[0] }
$speaker.Rate = 3
$speaker.Volume = 100
foreach ($clip in $plan.clips) {
  for ($index = 0; $index -lt $clip.sentences.Count; $index++) {
    $fileName = '{0}-{1:D2}.wav' -f $clip.id, $index
    $target = Join-Path $audioRoot $fileName
    $stream = New-Object -ComObject SAPI.SpFileStream
    try {
      $stream.Format.Type = 22
      $stream.Open($target, 3, $false)
      $speaker.AudioOutputStream = $stream
      $spoken = [string]$clip.sentences[$index].speech
      $spoken = $spoken -replace '\bQGH\b', 'Q G H' -replace '\bPTT\b', 'P T T' -replace '\bQNH\b', 'Q N H' -replace '\bQFE\b', 'Q F E' -replace '\bQDM\b', 'Q D M' -replace '\bQTE\b', 'Q T E' -replace 'D/F', 'direction finding' -replace 'U/S Compass', 'unserviceable compass'
      [void]$speaker.Speak($spoken, 0)
    } finally { $stream.Close(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($stream) }
  }
}
[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($speaker)
Write-Output 'Offline narration created.'

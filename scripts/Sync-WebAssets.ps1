[CmdletBinding()]
param(
    [ValidateSet('All', 'Android', 'Windows')]
    [string]$Target = 'All'
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$engineRoot = Join-Path $repoRoot 'packages\qgh-engine'
$staticRoot = Join-Path $repoRoot 'apps\web\static'
$targets = @{
    Android = Join-Path $repoRoot 'apps\android\app\src\main\assets'
    Windows = Join-Path $repoRoot 'apps\windows\app'
}
$engineFiles = @(
    'index.html',
    'entry.css',
    'user-guide.html',
    'training-centre.html',
    'training-centre.js',
    'training-centre.css',
    'rt-catalogue.js',
    'training-videos.json',
    'rt-reference.md',
    'single.html',
    'simulator-core.js',
    'procedure-core.js',
    'procedure-intent.js',
    'procedure-workspace.js',
    'procedure.css',
    'radio-session.js',
    'radio-workspace.js',
    'headphone-consent.js',
    'pilot-voice-engine.js',
    'pilot-voice-worker.js',
    'pilot-voices\manifest.json',
    'simulator.js',
    'voice-control.js',
    'offline-voice-engine.js',
    'voice-workspace.js',
    'voice.css',
    'guided-familiarisation.js',
    'guided-familiarisation.css',
    'workspace.css',
    'workspace.js',
    'tactical.html',
    'tactical.css',
    'tactical-core.js',
    'tactical-workspace.js',
    'tactical-simulator.js',
    'fonts\ibm-plex-mono-500.ttf',
    'fonts\ibm-plex-sans-400.ttf',
    'fonts\ibm-plex-sans-600.ttf',
    'fonts\OFL-1.1.txt',
    'vendor\vosk-browser-0.0.8.js',
    'vendor\Apache-2.0.txt',
    'voice-models\qgh-vosk-en-us-small-0.15.tar.gz',
    'voice-models\NOTICE.txt'
)
$assetDirectories = @(
    'pilot-voices',
    'training-media',
    'vendor\pilot-tts'
)
$releaseFiles = @('app-version.json')

foreach ($relativeDirectory in $assetDirectories) {
    $sourceDirectory = Join-Path $engineRoot $relativeDirectory
    if (-not (Test-Path -LiteralPath $sourceDirectory -PathType Container)) {
        throw "Shared engine asset directory is missing: $sourceDirectory"
    }
    foreach ($sourceFile in Get-ChildItem -LiteralPath $sourceDirectory -File -Recurse) {
        $engineFiles += $sourceFile.FullName.Substring($engineRoot.Length + 1)
    }
}
$engineFiles = @($engineFiles | Select-Object -Unique)

if (-not (Test-Path -LiteralPath $engineRoot)) {
    throw "Shared engine folder is missing: $engineRoot"
}

$selectedTargets = if ($Target -eq 'All') {
    @('Android', 'Windows')
} else {
    @($Target)
}

foreach ($targetName in $selectedTargets) {
    $destinationRoot = $targets[$targetName]
    if (-not $destinationRoot.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to write outside this repository: $destinationRoot"
    }

    foreach ($relativeFile in $engineFiles) {
        $sourceFile = Join-Path $engineRoot $relativeFile
        $destinationFile = Join-Path $destinationRoot $relativeFile
        if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) {
            throw "Shared engine file is missing: $sourceFile"
        }

        $destinationDirectory = Split-Path -Path $destinationFile -Parent
        if (-not (Test-Path -LiteralPath $destinationDirectory)) {
            New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
        }
        Copy-Item -LiteralPath $sourceFile -Destination $destinationFile -Force
    }

    foreach ($relativeFile in $releaseFiles) {
        $sourceFile = Join-Path $staticRoot $relativeFile
        $destinationFile = Join-Path $destinationRoot $relativeFile
        if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) {
            throw "Shared release file is missing: $sourceFile"
        }
        Copy-Item -LiteralPath $sourceFile -Destination $destinationFile -Force
    }

    Write-Output "Synced shared engine to $targetName."
}

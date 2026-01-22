$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$releaseDir = "zero-solana-v0.9.0"
$outputCrx = "zero-solana-v0.9.0.crx"

# 1. Prepare Clean Folder
if (Test-Path $releaseDir) { Remove-Item $releaseDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

Copy-Item "manifest.json" -Destination $releaseDir
Copy-Item "assets" -Destination $releaseDir -Recurse
Copy-Item "README.md" -Destination $releaseDir

New-Item -ItemType Directory -Force -Path "$releaseDir/src" | Out-Null
Copy-Item "src/*" -Destination "$releaseDir/src" -Recurse

# Remove protected source
if (Test-Path "$releaseDir/src/content.source.js") { Remove-Item "$releaseDir/src/content.source.js" -Force }
if (Test-Path "$releaseDir/src/content.js") { Remove-Item "$releaseDir/src/content.js" -Force }

Write-Host "Prepared clean folder: $releaseDir"

# 2. Pack Extension using Chrome
# Note: Chrome output files are placed at same level as input folder
# i.e., zero-solana-v0.8.0.crx and zero-solana-v0.8.0.pem

Write-Host "Running Chrome Pack..."
& $chromePath --pack-extension="$PWD\$releaseDir"

Start-Sleep -Seconds 2

if (Test-Path "$releaseDir.crx") {
    Write-Host "Success! Created $releaseDir.crx"
    # Clean up folder
    Remove-Item $releaseDir -Recurse -Force
}
else {
    Write-Host "Error: CRX file not created."
}

#!/usr/bin/env pwsh
# CI script: Build the GLACIER WSL image and import it as the 'glacier' distro.
# Uses the canonical build-wsl-image.js so all paths share the same logic.

# Build the pre-configured WSL image
node "$PSScriptRoot/build-wsl-image.js"

# Import as glacier distro
$wslDir = "$env:USERPROFILE\glacier\wsl"
$image = "bundle\wsl\glacier-wsl.tar"

mkdir $wslDir -Force
wsl.exe --unregister glacier 2>$null
wsl.exe --import glacier $wslDir $image

# Verify
wsl.exe -d glacier -- nextflow -v
wsl.exe -d glacier -- nextflow run hello
wsl.exe -d glacier -- docker run hello-world

Write-Host "GLACIER WSL distro is ready."

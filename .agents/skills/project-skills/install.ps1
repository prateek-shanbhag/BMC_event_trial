param (
    [string]$TargetDir = "$HOME\.project-skills"
)

Write-Host "Checking for Python 3.9+"
$pythonVersion = python --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Python not found. Please install Python 3.9+ and try again." -ForegroundColor Red
    exit 1
}
Write-Host "Found $pythonVersion"

if (Test-Path $TargetDir) {
    Write-Host "Target directory $TargetDir already exists. Merging changes safely."
    # Back up existing
    $backupDir = "${TargetDir}_backup_$(Get-Date -Format 'yyyyMMddHHmmss')"
    Copy-Item -Path $TargetDir -Destination $backupDir -Recurse
    Write-Host "Backed up to $backupDir"
} else {
    New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
}

$SourceDir = $PSScriptRoot
Copy-Item -Path "$SourceDir\*" -Destination $TargetDir -Recurse -Force

Write-Host "Installation complete at $TargetDir."
Write-Host "Run 'python $TargetDir\scripts\workflow.py init' in your project to start."

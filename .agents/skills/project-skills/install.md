# Installation Guide

## Requirements
- Python 3.9+
- Git Bash, WSL, Linux, macOS (for `.sh`)
- PowerShell (for `.ps1`)

## Windows
Open PowerShell and run:
```powershell
.\install.ps1 -TargetDir "C:\path\to\your\custom\skills\folder"
```

## macOS / Linux
Open terminal and run:
```bash
./install.sh /path/to/your/custom/skills/folder
```

## How to safely remove project runtime data
Delete the `.ai-workflow/` folder and `HANDOFF.md` from your project root.

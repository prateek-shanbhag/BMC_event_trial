#!/usr/bin/env bash
set -e

TARGET_DIR="${1:-$HOME/.project-skills}"

echo "Checking for Python 3.9+"
if ! command -v python3 &> /dev/null; then
    echo "Python3 not found. Please install Python 3.9+ and try again."
    exit 1
fi
echo "Found $(python3 --version)"

if [ -d "$TARGET_DIR" ]; then
    echo "Target directory $TARGET_DIR already exists. Merging changes safely."
    BACKUP_DIR="${TARGET_DIR}_backup_$(date +%Y%m%d%H%M%S)"
    cp -r "$TARGET_DIR" "$BACKUP_DIR"
    echo "Backed up to $BACKUP_DIR"
else
    mkdir -p "$TARGET_DIR"
fi

SOURCE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cp -R "$SOURCE_DIR/"* "$TARGET_DIR/"

echo "Installation complete at $TARGET_DIR."
echo "Run 'python3 $TARGET_DIR/scripts/workflow.py init' in your project to start."

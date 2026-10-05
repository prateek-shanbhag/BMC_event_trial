# project-skills

A complete, polished, reusable local AI-workflow skill package for workflow tracking.

## Purpose
1. **project-handoff**: Keeps a project `HANDOFF.md` up to date after every three completed user interactions.
2. **ai-usage-log**: Maintains durable, append-only local logs of user prompts, AI/LLM usage, and agent actions.
3. **prompt-archive-fluency**: Search and export prompt history, generate AI-fluency reports.

## Installation
See `install.md` for complete installation instructions using `install.ps1` or `install.sh`.

## Initialization
In your project directory, run:
```bash
python path/to/project-skills/scripts/workflow.py init
```
This creates `.ai-workflow/` containing config, logs, state, and reports. It also creates a `HANDOFF.md` template if one doesn't exist.

## Commands
All skills share the same CLI engine:
- `init`: Create runtime structure safely.
- `status`: Check if initialized and interaction count.
- `doctor`: Check setup and hooks.
- `record-prompt <text>`: Log a redacted prompt.
- `log <summary>`: Log an action and check handoff trigger.
- `handoff`: Manually regenerate `HANDOFF.md` preserving user notes.
- `prompts [--keyword <keyword>]`: Search prompt history.
- `fluency-report`: Generate an AI fluency report.
- `export [--out <file>]`: Export usage logs.
- `install-hooks`: Install automatic hooks if supported.

## Limitations
Automatic hooks are environment dependent. If not supported, manual fallback via `record-prompt` and `log` is required.
No external telemetry is sent. All data is kept local.

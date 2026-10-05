# Hook Support

Hooks for automatic prompt recording and handoff generation are supported via Claude Code hooks, but are not guaranteed across all generic IDE and agent environments.
If hooks do not automatically trigger, use manual fallbacks:
- `python scripts/workflow.py record-prompt "My prompt"`
- `python scripts/workflow.py log "My action"`
- `python scripts/workflow.py handoff`

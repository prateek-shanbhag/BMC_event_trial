---
name: ai-usage-log
description: Maintains durable, append-only local logs of user prompts and AI usage.
---

# ai-usage-log

**When to apply:** When you need to log an action, completion, or manual prompt.

**First-use Initialization:**
If not initialized, prompt the user to run `python scripts/workflow.py init`.

**Shared CLI Commands:**
- `python scripts/workflow.py record-prompt "<text>"`
- `python scripts/workflow.py log "<summary>"`

**Usage:**
- Use manual fallback if automatic hooks aren't enabled.
- The script automatically handles redaction for privacy.

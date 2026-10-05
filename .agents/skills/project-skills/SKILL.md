---
name: project-skills
description: Umbrella skill for project-handoff, ai-usage-log, and prompt-archive-fluency.
---

# project-skills

This is an umbrella skill that initializes and routes to:
1. `project-handoff`: Maintains `HANDOFF.md`.
2. `ai-usage-log`: Maintains append-only local logs of prompts and usage.
3. `prompt-archive-fluency`: Searches prompts and generates AI-fluency reports.

**Initialization:**
Run `python scripts/workflow.py init` to initialize the project environment (safe to run repeatedly).

**Routing:**
- For handoff updates -> See `skills/project-handoff/SKILL.md`.
- For logging prompts/actions -> See `skills/ai-usage-log/SKILL.md`.
- For searching or fluency -> See `skills/prompt-archive-fluency/SKILL.md`.

For status or doctor, use:
- `python scripts/workflow.py status`
- `python scripts/workflow.py doctor`

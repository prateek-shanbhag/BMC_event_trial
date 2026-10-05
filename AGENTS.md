# Agent Instructions

This project uses `project-skills` for workflow tracking.

As an AI agent operating in this project, you must:
1. Ensure `.ai-workflow` is initialized. If not, run `python .agents/skills/project-skills/scripts/workflow.py init`.
2. Record user prompts manually via `python .agents/skills/project-skills/scripts/workflow.py record-prompt "<text>"` on every user turn.
3. Log meaningful actions and completions using `python .agents/skills/project-skills/scripts/workflow.py log "<summary>"`.
4. Keep [HANDOFF.md](file:///c:/Users/prate/OneDrive/Desktop/BMC_event_trial/HANDOFF.md) updated. The workflow tool automatically regenerates or triggers handoffs every 3 interactions, but you can also update/regenerate it via `python .agents/skills/project-skills/scripts/workflow.py handoff`.
5. For searching past prompts or generating fluency reports, use:
   - `python .agents/skills/project-skills/scripts/workflow.py prompts --keyword <keyword>`
   - `python .agents/skills/project-skills/scripts/workflow.py fluency-report`

Always respect privacy constraints and never bypass the redaction script.


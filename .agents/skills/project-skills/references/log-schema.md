# Log Schema

Append-only `usage.jsonl` contains the following possible properties:
- `timestamp`: ISO 8601 UTC
- `event`: "prompt" | "action" | "handoff" | "report"
- `text`: Prompt text, redacted
- `summary`: Short action summary

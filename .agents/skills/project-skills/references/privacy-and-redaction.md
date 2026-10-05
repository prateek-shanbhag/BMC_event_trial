# Privacy & Redaction

The redact.py script intercepts prompts and attempts to remove obvious secrets like API keys and passwords before they are written to `usage.jsonl`.
No data is sent to external cloud services; all data stays strictly local in `.ai-workflow/`.

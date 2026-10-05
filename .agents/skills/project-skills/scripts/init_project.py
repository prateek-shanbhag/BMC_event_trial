import os
import json
import shutil
from pathlib import Path

def init_project(project_root: str):
    root = Path(project_root)
    ai_dir = root / ".ai-workflow"
    config_dir = ai_dir / "config"
    logs_dir = ai_dir / "logs"
    state_dir = ai_dir / "state"
    reports_dir = ai_dir / "reports"

    for d in [config_dir, logs_dir, state_dir, reports_dir]:
        d.mkdir(parents=True, exist_ok=True)

    config_file = config_dir / "config.json"
    if not config_file.exists():
        # Try to find template
        template_dir = Path(__file__).parent.parent / "templates"
        config_template = template_dir / "config.json"
        if config_template.exists():
            shutil.copy2(config_template, config_file)
        else:
            default_config = {"prompt_storage": "full"}
            config_file.write_text(json.dumps(default_config, indent=2))

    state_file = state_dir / "state.json"
    if not state_file.exists():
        state_file.write_text(json.dumps({"interaction_count": 0}, indent=2))

    log_file = logs_dir / "usage.jsonl"
    if not log_file.exists():
        log_file.touch()
        
    handoff_file = root / "HANDOFF.md"
    if not handoff_file.exists():
        template_dir = Path(__file__).parent.parent / "templates"
        handoff_template = template_dir / "HANDOFF.md"
        if handoff_template.exists():
            shutil.copy2(handoff_template, handoff_file)
        else:
            handoff_file.write_text("# Project Handoff\n\n## User Notes\n\n")
            
    print("Initialization complete.")

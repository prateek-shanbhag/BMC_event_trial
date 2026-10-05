import argparse
import sys
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

# Fix module imports when run directly or from parent
sys.path.insert(0, str(Path(__file__).parent))
from redact import redact_text
from init_project import init_project
from install_hooks import install_hooks

def get_state(project_root):
    state_file = Path(project_root) / ".ai-workflow" / "state" / "state.json"
    if not state_file.exists():
        return {"interaction_count": 0}
    with open(state_file, "r") as f:
        return json.load(f)

def save_state(project_root, state):
    state_file = Path(project_root) / ".ai-workflow" / "state" / "state.json"
    state_file.parent.mkdir(parents=True, exist_ok=True)
    with open(state_file, "w") as f:
        json.dump(state, f, indent=2)

def append_log(project_root, entry):
    log_file = Path(project_root) / ".ai-workflow" / "logs" / "usage.jsonl"
    log_file.parent.mkdir(parents=True, exist_ok=True)
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")

def regenerate_handoff(project_root):
    handoff_file = Path(project_root) / "HANDOFF.md"
    user_notes = ""
    if handoff_file.exists():
        content = handoff_file.read_text(encoding="utf-8")
        match = re.search(r'(?i)##\s*User Notes(.*)', content, re.DOTALL)
        if match:
            user_notes = match.group(1).strip()
            
    new_content = f"""# Project Handoff

*Last updated: {datetime.now(timezone.utc).isoformat()}*

## Active Objective
Describe the current goal here.

## Current State
Describe current state here.

## Completed Work
- Work done goes here.

## Important Files Changed
- file paths

## Decisions and Reasons
- decisions here

## Tests/Commands and Outcome
- tests here

## Known Issues or Blockers
- None

## Failed Approaches (Do Not Retry)
- None

## Next Recommended Steps
- next steps here

## User Notes
{user_notes if user_notes else 'Add your notes here.'}
"""
    handoff_file.write_text(new_content, encoding="utf-8")
    print("Regenerated HANDOFF.md")

def check_handoff_trigger(project_root):
    state = get_state(project_root)
    count = state.get("interaction_count", 0)
    count += 1
    state["interaction_count"] = count
    save_state(project_root, state)
    
    if count % 3 == 0:
        print(f"Reached {count} interactions. Triggering handoff regeneration.")
        regenerate_handoff(project_root)

def cmd_init(args):
    init_project(args.project_root)
    if args.agents:
        template_dir = Path(__file__).parent.parent / "templates"
        agents_template = template_dir / "AGENTS.md.tmpl"
        agents_file = Path(args.project_root) / "AGENTS.md"
        if agents_template.exists() and not agents_file.exists():
            import shutil
            shutil.copy2(agents_template, agents_file)
            print("Created AGENTS.md")

def cmd_status(args):
    ai_dir = Path(args.project_root) / ".ai-workflow"
    print(f"Initialized: {ai_dir.exists()}")
    print("Hooks: Manual fallback recommended in this generic environment.")
    state = get_state(args.project_root)
    print(f"Interaction count: {state.get('interaction_count', 0)}")

def cmd_doctor(args):
    ai_dir = Path(args.project_root) / ".ai-workflow"
    if not ai_dir.exists():
        print("Initialization missing. Run `python scripts/workflow.py init`.")
    else:
        print("Initialization complete.")
    print("Hooks: Check your environment documentation for hook support. Fallback to manual logging.")
    print("Next step: Use `record-prompt` and `log` commands to capture interactions.")

def cmd_record_prompt(args):
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": "prompt",
        "text": redact_text(args.text)
    }
    append_log(args.project_root, entry)
    print("Prompt recorded.")
    
def cmd_log(args):
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": "action",
        "summary": args.summary
    }
    append_log(args.project_root, entry)
    print("Action logged.")
    check_handoff_trigger(args.project_root)

def cmd_handoff(args):
    regenerate_handoff(args.project_root)

def cmd_prompts(args):
    log_file = Path(args.project_root) / ".ai-workflow" / "logs" / "usage.jsonl"
    if not log_file.exists():
        print("No logs found.")
        return
    with open(log_file, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            entry = json.loads(line)
            if entry.get("event") == "prompt":
                text = entry.get("text", "")
                if not args.keyword or args.keyword.lower() in text.lower():
                    print(f"[{entry.get('timestamp')}] {text}")

def cmd_fluency_report(args):
    log_file = Path(args.project_root) / ".ai-workflow" / "logs" / "usage.jsonl"
    if not log_file.exists():
        print("No logs found.")
        return
    
    prompt_count = 0
    action_count = 0
    with open(log_file, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            entry = json.loads(line)
            if entry.get("event") == "prompt":
                prompt_count += 1
            elif entry.get("event") == "action":
                action_count += 1
                
    report = f"""# AI Fluency Report

## Observable Facts
- Prompts recorded: {prompt_count}
- Actions recorded: {action_count}

## Inferences
- Interaction ratio is {'healthy' if action_count > 0 else 'low'}.

## Suggestions
- Try using more context and constraints in prompts.
"""
    reports_dir = Path(args.project_root) / ".ai-workflow" / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    report_file = reports_dir / f"fluency_report_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.md"
    report_file.write_text(report, encoding="utf-8")
    print(report)

def cmd_export(args):
    log_file = Path(args.project_root) / ".ai-workflow" / "logs" / "usage.jsonl"
    if not log_file.exists():
        print("No logs found.")
        return
    export_file = Path(args.project_root) / args.out
    import shutil
    shutil.copy2(log_file, export_file)
    print(f"Exported to {args.out}")

def cmd_install_hooks(args):
    install_hooks(args.project_root)

def main():
    parser = argparse.ArgumentParser(description="AI Workflow CLI")
    parser.add_argument("--project-root", default=os.getcwd(), help="Root directory of the project")
    
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    p_init = subparsers.add_parser("init", help="Initialize project")
    p_init.add_argument("--agents", action="store_true", help="Create portable AGENTS.md")
    
    subparsers.add_parser("status", help="Show status")
    subparsers.add_parser("doctor", help="Check setup")
    
    p_rec = subparsers.add_parser("record-prompt", help="Record a user prompt")
    p_rec.add_argument("text", help="Prompt text")
    
    p_log = subparsers.add_parser("log", help="Log an action/completion")
    p_log.add_argument("summary", help="Action summary")
    
    subparsers.add_parser("handoff", help="Regenerate handoff")
    
    p_prompts = subparsers.add_parser("prompts", help="Search prompts")
    p_prompts.add_argument("--keyword", help="Filter by keyword")
    
    subparsers.add_parser("fluency-report", help="Generate fluency report")
    
    p_exp = subparsers.add_parser("export", help="Export logs")
    p_exp.add_argument("--out", default="usage_export.jsonl", help="Output file")
    
    subparsers.add_parser("install-hooks", help="Install hooks")
    
    args = parser.parse_args()
    
    commands = {
        "init": cmd_init,
        "status": cmd_status,
        "doctor": cmd_doctor,
        "record-prompt": cmd_record_prompt,
        "log": cmd_log,
        "handoff": cmd_handoff,
        "prompts": cmd_prompts,
        "fluency-report": cmd_fluency_report,
        "export": cmd_export,
        "install-hooks": cmd_install_hooks
    }
    commands[args.command](args)

if __name__ == "__main__":
    main()

import unittest
import tempfile
import os
import shutil
import json
from pathlib import Path
import sys

# Ensure scripts can be imported
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
# pyrefly: ignore [missing-import]
import workflow
# pyrefly: ignore [missing-import]
import init_project
# pyrefly: ignore [missing-import]
import redact

class TestWorkflow(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        
    def tearDown(self):
        shutil.rmtree(self.temp_dir)
        
    def test_init_project(self):
        init_project.init_project(self.temp_dir)
        ai_dir = Path(self.temp_dir) / ".ai-workflow"
        self.assertTrue(ai_dir.exists())
        self.assertTrue((ai_dir / "logs" / "usage.jsonl").exists())
        self.assertTrue((ai_dir / "config" / "config.json").exists())
        
        # Test idempotency
        init_project.init_project(self.temp_dir)
        self.assertTrue(ai_dir.exists())
        
    def test_redact(self):
        text = "My secret api_key=supersecret1234567890 here."
        redacted = redact.redact_text(text)
        self.assertNotIn("supersecret1234567890", redacted)
        self.assertIn("[REDACTED]", redacted)
        
    def test_append_log_and_redact(self):
        init_project.init_project(self.temp_dir)
        import argparse
        args = argparse.Namespace(project_root=self.temp_dir, text="My key is api_key=supersecret1234567890")
        
        workflow.cmd_record_prompt(args)
        log_file = Path(self.temp_dir) / ".ai-workflow" / "logs" / "usage.jsonl"
        with open(log_file, "r") as f:
            lines = f.readlines()
            self.assertEqual(len(lines), 1)
            entry = json.loads(lines[0])
            self.assertNotIn("supersecret", entry["text"])
            self.assertIn("[REDACTED]", entry["text"])
            
    def test_interaction_counter_and_handoff(self):
        init_project.init_project(self.temp_dir)
        
        # Add a user note to handoff
        handoff = Path(self.temp_dir) / "HANDOFF.md"
        handoff.write_text("# Project Handoff\n\n## User Notes\nMy custom note.")
        
        import argparse
        args_log = argparse.Namespace(project_root=self.temp_dir, summary="Did some work")
            
        workflow.cmd_log(args_log)
        workflow.cmd_log(args_log)
        workflow.cmd_log(args_log)
        
        # Handoff should have regenerated but kept note
        content = handoff.read_text()
        self.assertIn("My custom note.", content)
        self.assertIn("## Active Objective", content)
        
        state = workflow.get_state(self.temp_dir)
        self.assertEqual(state["interaction_count"], 3)

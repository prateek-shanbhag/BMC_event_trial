In the root of this `project-skills` package, create a polished `USAGE.md` file for the package owner.

This file must be a practical “how I use this skill in any coding agent” guide. It must not contain project runtime data, logs, prompts, secrets, or machine-specific personal paths.

Include these sections:

1. **What this package does**  
   Briefly explain the umbrella skill and its three capabilities: project handoff, AI usage logging, and prompt archive/AI-fluency reports.

2. **Fastest first use**  
   A short five-step checklist:
   - install the package as a global or project-local skill;
   - restart or reload the agent;
   - confirm the skill is discovered;
   - invoke `/project-skills` or explicitly ask the agent to use it;
   - initialize tracking in the newly opened project.

3. **Global versus project-only installation**  
   Clearly compare:
   - global installation: available in all future projects;
   - project-local installation: stored in a project’s skill directory and shared with that project only.
   
   Explain that the whole `project-skills` folder must be copied, not only `SKILL.md`.

4. **Antigravity IDE — fully detailed**  
   Include the current supported locations:
   ```text
   Global: %USERPROFILE%\.gemini\config\skills\project-skills\
   Project-only: <project-root>\.agents\skills\project-skills\
   ```
   
   Include:
   - how to reload/restart Antigravity;
   - how to check discovery in Customizations;
   - how to use `/project-skills`;
   - a realistic first prompt for starting a website;
   - the expected project runtime output: `.ai-workflow/` and `HANDOFF.md`.

5. **Other coding agents**  
   Add separate sections for Claude Code, Codex, Cursor, Gemini CLI, and a generic fallback.
   
   Before writing each location or command, verify it from current official documentation or clearly label it as “verify for your installed version.” Do not invent paths.
   
   For every agent, explain:
   - global location, if officially supported;
   - project-local location, if officially supported;
   - how to invoke or mention the skill;
   - how to confirm discovery;
   - fallback behaviour if the agent does not support skills or hooks.

6. **Normal website-project workflow**  
   Show a concise example:
   ```text
   /project-skills
   Initialize AI workflow tracking for this project.
   Then build a responsive website for [purpose].
   ```
   
   Then show normal follow-up prompts and explain when `HANDOFF.md`, logs, and reports should appear.

7. **Commands reference**  
   Document the actual working commands from this package:
   ```text
   init
   status
   doctor
   record-prompt
   log
   handoff
   prompts
   fluency-report
   export
   install-hooks
   ```
   
   Use the real command syntax implemented by the package. Do not show commands that do not work.

8. **Troubleshooting**  
   Include solutions for:
   - skill does not appear;
   - slash command is unavailable;
   - hooks are not active;
   - project is in manual fallback mode;
   - Python is missing;
   - `.ai-workflow/` or `HANDOFF.md` was not created;
   - skill was copied incompletely.

9. **Safe update, reset, and removal**  
   Explain how to update the shared skill package without deleting live per-project logs, how to reset only a project’s tracking data, and how to uninstall safely.

10. **Honest limitations**  
    State that automatic prompt capture and automatic “every three interactions” handoffs only work in agents/environments that support the required hooks. Explain the manual fallback clearly.

Use clear beginner-friendly language, Windows-friendly examples first, and concise Markdown. Link to `README.md`, `install.md`, and relevant `references/` files where useful.

After creating it, verify that it matches the actual scripts and package behaviour. Do not claim support for any agent, path, command, or hook that is not implemented or documented.
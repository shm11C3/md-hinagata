---
name: claude-auto-review
description: Run an external Claude CLI review of local git changes. Use when the user asks Codex to ask Claude for a review, send an uncommitted diff to Claude, run a Claude automatic review, compare Codex work against Claude, or triage Claude review findings for bugs, regressions, security issues, and missing tests.
---

# Claude Auto Review

Use this skill to get an independent Claude CLI review of local git changes, then triage the result instead of blindly applying it.

## Safety Gate

Claude CLI may send repository files, diffs, and prompts to Anthropic's service. Before running it on uncommitted or private work, confirm the user has explicitly allowed sending the relevant local changes to Claude in the current task. If not, ask for permission and stop.

Never use this skill to modify files through Claude. The Claude prompt must say "Do not modify files." Treat Claude findings as review input to evaluate.

## Preflight

From the target repository:

```bash
git status --short --branch
git diff --stat
claude auth status
```

If Claude is not logged in, ask the user to log in. If the diff appears to include secrets or unrelated private content, stop and ask before continuing.

## Run The Review

Prefer directory mode so Claude can inspect `git diff` and relevant files without manually pasting a giant diff:

```bash
python3 .agents/skills/claude-auto-review/scripts/run_claude_auto_review.py --repo /path/to/repo
```

Add focused context when useful:

```bash
python3 .agents/skills/claude-auto-review/scripts/run_claude_auto_review.py \
  --repo /path/to/repo \
  --focus "This replaces the Rust core Handlebars renderer with a minimal Template Interpolation renderer."
```

The helper builds a command like:

```bash
claude -p --verbose --add-dir /path/to/repo \
  --output-format stream-json --include-partial-messages \
  --allowedTools "Read,Bash(git status:*),Bash(git diff:*),Bash(git show:*),Bash(rg:*)" \
  "Review the current local changes..."
```

Use `--dry-run` to inspect the command and prompt. Use `--bypass-permissions` only after the user has explicitly approved a non-interactive Claude run; it can broaden what Claude is allowed to do, so keep the prompt read-only and inspect the stream for unexpected tool calls.

## Prompt Shape

The review prompt should ask for:

- Findings first, ordered by severity.
- Actionable bugs, behavioral regressions, security issues, and missing tests.
- File and line references where possible.
- A clear "no issues found" statement when applicable.
- Residual risks and skipped checks.

It should not ask for broad refactors, style churn, or implementation changes.

## Triage The Output

Summarize Claude's final findings in the user's language. Apply the repository's normal review policy:

- Do not blindly follow Claude.
- Classify each finding as valid, by-design, out-of-scope, or needing follow-up.
- If the user only asked for a review, report findings without changing files.
- If the user asked to implement fixes, make only the validated in-scope fixes and rerun relevant checks.

If Claude hangs, poll for a bounded period, then kill only the scoped Claude process and report that the run did not complete.

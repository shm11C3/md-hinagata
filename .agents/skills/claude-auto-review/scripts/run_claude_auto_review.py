#!/usr/bin/env python3
"""Run Claude CLI in directory-review mode and print the final review text."""

from __future__ import annotations

import argparse
import json
import shlex
import subprocess
import sys
from pathlib import Path


DEFAULT_ALLOWED_TOOLS = (
    "Read,"
    "Bash(git status:*),"
    "Bash(git diff:*),"
    "Bash(git show:*),"
    "Bash(rg:*)"
)


def build_prompt(repo: Path, focus: str | None, custom_prompt: str | None) -> str:
    if custom_prompt:
        return custom_prompt

    parts = [
        f"Review the current local changes in {repo}.",
        "Focus only on actionable bugs, behavioral regressions, security issues, and missing tests.",
        "Do not modify files.",
        "Inspect git diff and relevant files.",
        "Output findings first, ordered by severity, with file/line references.",
        "If no issues are found, say so clearly and mention residual risks or skipped checks.",
    ]
    if focus:
        parts.append(f"Context: {focus}")
    return " ".join(parts)


def build_command(args: argparse.Namespace) -> list[str]:
    repo = Path(args.repo).expanduser().resolve()
    prompt = build_prompt(repo, args.focus, args.prompt)

    command = [
        "claude",
        "-p",
        "--verbose",
        "--add-dir",
        str(repo),
        "--output-format",
        "stream-json",
        "--include-partial-messages",
        "--allowedTools",
        args.allowed_tools,
    ]
    if args.bypass_permissions:
        command.extend(["--permission-mode", "bypassPermissions"])
    command.append(prompt)
    return command


def parse_stream_line(line: str, text_parts: list[str]) -> str | None:
    try:
        event = json.loads(line)
    except json.JSONDecodeError:
        return None

    if event.get("type") == "result" and isinstance(event.get("result"), str):
        return event["result"]

    stream_event = event.get("event")
    if isinstance(stream_event, dict):
        delta = stream_event.get("delta")
        if isinstance(delta, dict) and delta.get("type") == "text_delta":
            text = delta.get("text")
            if isinstance(text, str):
                text_parts.append(text)

    return None


def run(command: list[str]) -> int:
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=None,
        text=True,
        bufsize=1,
    )

    final_result = None
    text_parts: list[str] = []
    assert process.stdout is not None
    for line in process.stdout:
        result = parse_stream_line(line, text_parts)
        if result is not None:
            final_result = result

    return_code = process.wait()
    output = final_result if final_result is not None else "".join(text_parts).strip()
    if output:
        print(output)
    return return_code


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=".", help="Repository path to review.")
    parser.add_argument("--focus", help="Short task-specific context for Claude.")
    parser.add_argument("--prompt", help="Full custom prompt. Overrides --focus.")
    parser.add_argument(
        "--allowed-tools",
        default=DEFAULT_ALLOWED_TOOLS,
        help="Claude CLI allowedTools value.",
    )
    parser.add_argument(
        "--bypass-permissions",
        action="store_true",
        help="Run with --permission-mode bypassPermissions after explicit user approval.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the Claude command without running it.",
    )
    args = parser.parse_args()

    command = build_command(args)
    if args.dry_run:
        print(shlex.join(command))
        return 0

    return run(command)


if __name__ == "__main__":
    sys.exit(main())

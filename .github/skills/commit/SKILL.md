---
name: commit
description: 'Review git changes, write a Conventional Commit message, and create a git commit without pushing. Use when the user wants to commit all current changes or a specific scoped subset of files.'
argument-hint: 'Describe what should be committed or the scope to review.'
user-invocable: true
---

# Commit

Use this skill when the task is to inspect the current git changes, prepare a Conventional Commit message, and create a commit.

## Constraints

- Do not push, amend, rebase, or rewrite history unless the user explicitly asks.
- Do not include unrelated changes when the requested commit scope is narrower than the full working tree.
- Only create a commit after reviewing the current git status and the relevant diff.
- If the requested scope is ambiguous, clarify the intended files before staging or committing.

## Procedure

1. Review the current working tree with `git status --short` and inspect the relevant diff for the requested scope.
2. Decide whether the current changes belong in one coherent commit or should be split into multiple commits.
3. If only part of the working tree should be committed, stage only the intended files or hunks.
4. Write a Conventional Commit message that matches the actual change.
5. Create the commit.
6. Report the final commit hash and subject back to the user.

## Commit Message Rules

- Use the format below.
- Keep the subject line at 50 characters or fewer.
- Use imperative mood.
- Capitalize the subject.
- Do not end the subject with a period.
- Add a body only when it improves clarity.
- When a body is needed, leave one blank line before it and wrap lines near 72 characters.
- Explain both what changed and why, not just the file list.

## Commit Format

```text
<type>(<scope>): <subject>

<body>
```

Valid `type` examples: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`.

If no conventional scope is helpful, omit the parentheses and use `<type>: <subject>`.

## Output Expectations

After committing, provide:

- The commit hash
- The final subject line
- A short summary of what was included in the commit
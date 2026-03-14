# @n8io/ai-config

## 0.5.0

### Minor Changes

- e829d40: Test version package flow with minor version bump to verify release workflow.

### Patch Changes

- d48f2bc: Fix release workflow to only publish from Version Packages PR merge, preventing 403 errors from re-publishing already-published versions.

## 0.4.0

### Minor Changes

- cb34a9e: Add Jira skill to the skills manifest for installation via ai-config setup

### Patch Changes

- e6b1210: Fix missing shebang in dist/cli.js causing `sh: ai-config: command not found` when running via npx

## 0.3.0

### Minor Changes

- 4b2702a: Add `agents` topic with `code-style-alphasort` Claude Code subagent

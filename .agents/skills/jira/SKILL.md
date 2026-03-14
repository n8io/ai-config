---
name: jira
description: Use when a JIRA ticket ID (e.g. PROJ-123, ABC-456) is mentioned and the user needs ticket context, or when explicitly invoked with /jira <ticket-id>.
---

# JIRA Ticket Context

Fetch and display JIRA ticket details, comments, and attachments using `jcfa` via Docker.

## Setup Check

Before any operation, verify the image exists:

```bash
docker image inspect jcfa:latest >/dev/null 2>&1 || docker build -t jcfa:latest "$HOME/.claude/skills/jira/"
```

If `$HOME/.jcfa/` does not exist, the user must run first-time auth setup **in their own terminal** (requires interactive input). Tell the user to run:

```
docker run -it --rm -v "$HOME/.jcfa:/root/.jcfa" jcfa:latest configure
```

Wait for the user to confirm configuration is complete before proceeding.

## Docker Run Pattern

**Important:** `$HOME` expansion can be unreliable. Before running any docker command, resolve the home directory: `JCFA_HOME=$(echo $HOME)` and use `$JCFA_HOME` in volume mounts. Always quote mount paths.

Base pattern (auth config only):

```
docker run --rm -v "$HOME/.jcfa:/root/.jcfa" jcfa:latest <command>
```

For downloads, add the output volume:

```
docker run --rm -v "$HOME/.jcfa:/root/.jcfa" -v "/tmp/jira/<TICKET-ID>:/tmp/jira/<TICKET-ID>" jcfa:latest <command>
```

## Fetch Sequence

Given a ticket ID (e.g. `PROJ-123`), execute these steps in order:

**Step 1 -- Fetch issue details:**

```bash
docker run --rm -v "$HOME/.jcfa:/root/.jcfa" jcfa:latest get PROJ-123 --full --json
```

Parse: summary, description, status, assignee, priority, labels, linked issues, subtasks, and comments (with author + timestamp).

**Step 2 -- List attachments:**

```bash
docker run --rm -v "$HOME/.jcfa:/root/.jcfa" jcfa:latest attachment list PROJ-123 --json
```

Categorize by MIME type: `image/*` -> download, `video/*` -> skip entirely, everything else -> download. If no attachments, skip to step 4.

**Step 3 -- Download non-video attachments:**

```bash
mkdir -p /tmp/jira/PROJ-123
docker run --rm -v "$HOME/.jcfa:/root/.jcfa" -v /tmp/jira/PROJ-123:/tmp/jira/PROJ-123 jcfa:latest attachment download PROJ-123 <filename> --output /tmp/jira/PROJ-123/
```

Download each non-video attachment individually. Report failures but continue with remaining files.

**Step 4 -- Present summary to user:**

- Issue: title, status, assignee, priority, labels
- Description: formatted content
- Comments: each with author and timestamp
- Downloaded files: list with local paths in `/tmp/jira/PROJ-123/`
- Downloaded images: list with local paths

**Step 5 -- Offer image display:**

If images were downloaded, ask the user which ones to view inline. Use the Read tool to display selected images.

## Error Handling

- **Ticket not found:** Inform user the ID may be wrong or they lack permissions.
- **Auth expired:** Tell user to re-run in their own terminal: `docker run -it --rm -v "$HOME/.jcfa:/root/.jcfa" jcfa:latest configure`
- **Download failure:** Report which files failed, continue with the rest.
- **No attachments:** Skip attachment steps, show issue details and comments only.

## Quick Reference

All commands below require the Docker run pattern above.

| Action | Command |
|---|---|
| Get issue | `jcfa get TICKET-ID --full --json` |
| List attachments | `jcfa attachment list TICKET-ID --json` |
| Download attachment | `jcfa attachment download TICKET-ID FILE --output DIR/` |
| Reconfigure auth | `jcfa configure` (interactive, user runs in their terminal) |

---
name: commit
description: Commit message format with gitmojis
argument-hint: [ticket-number]
allowed-tools: Bash
model: haiku
---

Staged diff:
!`git diff --staged`

Status:
!`git status --short`

Branch:
!`git branch --show-current`

---

Generate a commit message for the staged changes above following this format exactly:

```
<type>(<ticket>): <gitmoji> <Subject line in sentence case>

- <change in prose>
- <change in prose>
```

**Rules:**

- **Type**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, or `build`
- **Ticket**: Use `$ARGUMENTS` if provided. Otherwise try to extract from the branch name (e.g. `feature/PROJ-123-description` → `PROJ-123`). If no ticket found, omit the parentheses entirely.
- **Gitmoji**: Pick the single most fitting emoji from gitmoji.dev for the overall changeset. Common mappings:
  - ✨ new feature · 🐛 bug fix · ♻️ refactor · 📝 docs · 🎨 code structure
  - 🔧 config · 🚀 deploy · ✅ tests · 💄 UI/style · ⬆️ upgrade deps
  - 🔥 remove code · 💥 breaking change · 🐳 Docker · 🙈 gitignore · 🧪 failing test
  - 🏗️ architecture · 📦 packages · 🔒 security · 🌐 i18n · ⏪ revert
- **Subject**: Sentence case, imperative mood, no trailing period. Entire header line ≤ 120 chars.
- **Body**: Unordered list of individual changes in plain prose. Omit body if the subject fully captures everything.

Commit immediately using:
```bash
git commit -m "$(cat <<'EOF'
<message here>
EOF
)"
```

Stage all changes and create a commit with an auto-generated message.

Steps:
1. Run `git status` to see what has changed.
2. Run `git diff` (and `git diff --staged`) to understand the nature of the changes.
3. Stage everything: `git add -A`
4. Derive a concise commit message in imperative mood that accurately describes the changes (e.g. "Add restart button to pause overlay"). Do NOT include bullet lists — one short sentence is enough.
5. Commit using a heredoc so the message is formatted correctly, and append the Co-Authored-By trailer:

```
git commit -m "$(cat <<'EOF'
<your message here>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

6. Run `git status` to confirm the working tree is clean.
7. Report the commit hash and message.

Commit all pending changes, push to GitHub, and confirm the GitHub Pages deployment.

This agent runs three stages in sequence — stop immediately if any stage fails.

---

## Stage 1 — Commit

1. Run `git status` and `git diff` to understand what changed.
2. If there are no changes, skip to Stage 2.
3. Stage everything: `git add -A`
4. Write a concise imperative commit message describing the changes.
5. Commit with the Co-Authored-By trailer:

```
git commit -m "$(cat <<'EOF'
<your message here>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Stage 2 — Push

1. Run `git push origin main`.
2. Confirm the push succeeded before continuing.

---

## Stage 3 — Verify deployment

1. Run `~/bin/gh run list --limit 1 --repo kodkod88/iron-dome` to get the latest Pages build.
2. Report the build status (queued / in_progress / completed).
3. Print the live URL: https://kodkod88.github.io/iron-dome

---

Report a one-line summary at the end:
- commit hash
- push result
- Pages build status + live URL

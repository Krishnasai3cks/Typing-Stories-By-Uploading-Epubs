# Commit email policy

Only commits from the **Krishnasai3cks** GitHub identity are allowed.

## Allowed emails

- `krishnasai3cks@gmail.com`
- GitHub noreply for that account, e.g. `12345678+Krishnasai3cks@users.noreply.github.com`

## Enforcement in this repo

1. **Local hooks** (`.githooks/`) — block bad commits before they are created
2. **GitHub Actions** (`.github/workflows/commit-email-check.yml`) — block bad commits on `push` / PRs to `main`
3. **Cursor rule** (`.cursor/rules/git-commit-identity.mdc`) — tells the coding agent which identity to use

## One-time local setup

Point git at this repo’s hooks:

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit .githooks/commit-msg scripts/verify-commit-email.sh
```

Set the author for **this repo only**:

```bash
git config user.email "krishnasai3cks@gmail.com"
git config user.name "Krishnasai3cks"
```

Test:

```bash
./scripts/verify-commit-email.sh
```

## Optional: GitHub Ruleset (UI)

GitHub cannot enforce author email from `main` alone without Actions or a ruleset.

1. Repo → **Settings** → **Rules** → **Rulesets** → **New branch ruleset**
2. Target branch: `main`
3. Add rule: **Require commit author email pattern** (if available on your plan)
4. Pattern: `(?i)(krishnasai3cks@gmail\.com|(\d+\+)?krishnasai3cks@users\.noreply\.github\.com)`

The GitHub Action above works on free plans and is the recommended enforcement.

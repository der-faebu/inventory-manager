# AGENTS.md

## Agent skills

### Issue tracker

Issues live in GitHub Issues (der-faebu/inventory-manager), using the `gh` CLI. External PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

No PR workflow — branches (e.g. `astro-migration`) live side by side with `main` rather than merging via PR. Close an issue directly with `gh issue close <N> --comment "..."` as soon as its ticket is implemented and committed; don't leave it open waiting for a merge.

### Triage labels

Default label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix) — no overrides. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

# GitHub issue tracker

Issues and specs live in GitHub Issues for `maeek/rebroid`. Use `gh` with `--repo maeek/rebroid` for issue operations. Use explicit `repos/maeek/rebroid/…` paths for `gh api` calls. Prefix shell commands with `rtk`.

## Issue operations

- Read or fetch a ticket with `gh issue view <number> --repo maeek/rebroid --json number,title,body,labels,comments`.
- List issues with `gh issue list --repo maeek/rebroid` and the relevant `--state` and `--label` filters.
- Publish an issue or spec with `gh issue create --repo maeek/rebroid --title "<title>" --body-file <file>`.
- Link child tickets with `--parent <parent>` when creating, or with `gh issue edit <parent> --add-sub-issue <child>` afterward. If sub-issues are unavailable, add `Part of #<parent>` to the child body.
- Record blockers with `--blocked-by <number>,<number>` when creating, or with `gh issue edit <child> --add-blocked-by <blocker>` afterward. If native dependencies are unavailable, put a `Blocked by: #<number>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- Count open native blockers with `gh api repos/maeek/rebroid/issues/<number> --jq .issue_dependencies_summary.blocked_by`.
- Apply or remove labels with `gh issue edit <number> --add-label "<label>"` or `--remove-label "<label>"`. Use [the triage mapping](triage-labels.md).
- Close an issue by posting the explanation with `gh issue comment <number> --body-file <file>`, then running `gh issue close <number>`.

## Pull requests as a triage surface

**PRs as a request surface: no.**

If enabled, triage external pull requests with the same label mapping and state transitions. List open pull requests through `gh api --paginate 'repos/maeek/rebroid/pulls?state=open'`, excluding authors associated as `OWNER`, `MEMBER`, or `COLLABORATOR`. Read a PR with `gh pr view`, `gh pr view --comments`, and `gh pr diff`. Use the corresponding `gh pr` commands to comment, edit labels, or close.

## Wayfinding

- Store the map's notes, decisions, and open questions in one issue labeled `wayfinder:map`.
- Link each ticket as a sub-issue and label it `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`. If sub-issues are unavailable, keep an ordered task list in the map and link each child back to its parent.
- Choose the first open, unassigned child in map order whose blockers are all closed. Claim it with `gh issue edit <number> --add-assignee @me` before starting work.
- Resolve the child by posting the answer and closing the issue, then add a summary and issue link to the map's decisions.

# Knowledge Base

This directory is the source of truth that AI agents consume when working on
projects in this organisation. Each file covers a specific domain; agents should
load only the files relevant to the task at hand.

## Files

| File | What it covers | Load when |
|---|---|---|
| `conventions.md` | Universal TypeScript naming and file standards | Always |
| `reactConventions.md` | React/Vite component structure, hooks, folder layout | Working on a React frontend |
| `issue-workflow.md` | Branch naming, commit format, PR standards, definition of done | Starting or closing out an issue |
| `testing.md` | Test file location, naming, mocking patterns, coverage expectations | Writing or reviewing tests |
| `review-checklist.md` | What reviewers check before approving a PR | Reviewing or preparing a PR |
| `release-process.md` | Versioning policy, release checklist, deployment, rollback | Releasing or working near deployment |
| `architecture.md` | System design decisions and component overview | Designing features, reviewing large changes |
| `examples.md` | Concrete code patterns and reference snippets | Unsure how the team handles a particular pattern |

## How to use this knowledge base

**As an agent:** load the files listed in the "Load when" column that match your
current task. Do not load files that are irrelevant — keep context tight.

**As a contributor:** keep each file focused on its stated domain. If a rule
applies to all TypeScript projects, it belongs in `conventions.md`. If it only
makes sense in a React context, it belongs in `reactConventions.md`. Add new
files for new domains rather than expanding existing files beyond their scope.
When a file grows past ~150 lines, consider splitting it.

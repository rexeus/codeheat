# AGENTS.md

codeheat — a CLI that shows where complexity and change frequency meet in a git repository (hotspots) and which files keep changing together (change coupling). Humans get a treemap, agents get JSON. TypeScript with Effect 4. `CLAUDE.md` is a symlink to this file.

Read [TESTING.md](TESTING.md) before adding or changing tests and [GLOSSARY.md](GLOSSARY.md) for the domain terms. The [documentation index](docs/README.md) maps everything else.

## Always / Ask first / Never

**Always**

- Load the `effect-ts` skill and read the pinned Effect reference (below) before writing Effect code. Verify every Effect symbol against the pinned source.
- Run `pnpm check` before handing work back, and report what you ran.
- Add a changeset (`pnpm changeset`) when a change is visible to `codeheat` users; see [.changeset/README.md](.changeset/README.md).

**Ask first**

- Upgrading Effect or any toolchain package.
- Changing the JSON report contract (`schemaVersion`), a command, a flag, or an exit code.
- Adding a runtime dependency.

**Never**

- Commit or push without being asked.
- Edit `.repos/effect`, or weaken a lint rule to make an import pass.
- Write anything but the JSON document to stdout in `--json` mode.

## Learning Effect

This repository is built on **Effect 4**, which is still pre-release. Its API differs substantially from Effect 3 and from what a language model is likely to recall. Writing Effect code from memory produces code that does not compile.

Before writing any Effect code, read `.repos/effect/.agents/AGENTS.md` completely for API idioms, and follow its links when required. Its workflow instructions (its own `pnpm` scripts, changesets, test policy) do not apply here. `.repos/effect/LLMS.md` and `.repos/effect/MIGRATION.md` cover the same ground from other angles; `.repos/effect/ai-docs/src/` has runnable examples (`70_cli`, `60_child-process`). For anything else read `.repos/effect/packages/effect/src`.

Known traps in the pinned release: the CLI modules live at `effect/cli` (`Command`, `Flag`, `Argument`), constructors are PascalCase (`Flag.String`, `Flag.Boolean`), and `ChildProcessSpawner.string`/`lines` do not fail on a non-zero exit code — use `spawn` and check `exitCode`.

`.repos/effect` is a partial clone pinned to the tag and commit in `scripts/effect-reference.mjs`. `pnpm install` creates it and `pnpm prepare:effect-reference` repairs it; `pnpm verify:effect-reference` asserts it is intact and is the first step of `pnpm check`. It is not tracked by git.

## Commands

```bash
pnpm install         # also prepares the Effect reference and patches tsgo/oxlint
pnpm check           # the gate: reference + format:check + lint + typecheck + test
pnpm format          # oxfmt
pnpm lint            # barrel check + oxlint (strict + Effect preset) + knip
pnpm typecheck       # tsc over scripts/, then every package via turbo
pnpm test            # scripts/ tests, then every package's vitest suite via turbo
pnpm --filter <pkg> exec vitest run src/<file>.test.ts   # one file
pnpm --filter codeheat dev <args>                     # run the CLI from source
```

## Architecture rules

| Package                 | Owns                                                                  | Public API                                   |
| ----------------------- | --------------------------------------------------------------------- | -------------------------------------------- |
| `@codeheat/engine`      | which files count, git history, metrics, scoring, the report contract | `analyze`, `inspect`, report schemas, errors |
| `@codeheat/viewer`      | the treemap and the self-contained HTML document                      | `renderReportHtml`                           |
| `codeheat` (`apps/cli`) | arguments, terminal and JSON output, exit codes, opening the browser  | none — only the `bin`                        |

- The engine imports no workspace package and no `node:` builtin; it reaches the platform through Effect services (`FileSystem`, `Path`, `ChildProcessSpawner`).
- The viewer is plain browser code: no Effect, no `node:`, and engine **types** only (`import type`).
- The CLI composes engine and viewer through their entry points only.
- A package's only barrel is its `src/index.ts`. Every export there has a production caller; knip rejects the rest. Inside a package, import the module that owns a symbol.

`no-restricted-imports` in `.oxlintrc.json`, `scripts/check-module-reexports.ts`, and knip enforce these rules. If a rule blocks an import, the import is wrong, not the rule.

## Code rules

- Source files stay within 250 lines and tests within 350; functions within 60 lines, complexity 12. Past a limit, review the responsibility instead of extracting mechanically.
- Prefer named decisions, guard clauses, and small policy functions. Prefer `const` and immutable transformations.
- Keep untrusted values (`git` output, file contents, paths) `unknown` or validated at the boundary; never widen to `any`. Render paths with terminal-safe escaping in the CLI and with `textContent` in the viewer.
- Comment only what code cannot say: caller contracts and rationale, in the present tense. Document every public export's contract.

## Working agreements

- Chat is German; everything in the repo (docs, code, comments, commits) is English.
- Commits follow Conventional Commits; branches are named `<type>/<topic>`.
- Follow-ups belong in GitHub issues, not source TODOs.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

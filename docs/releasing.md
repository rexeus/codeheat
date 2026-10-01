# Releasing

`codeheat` is published to npm by `.github/workflows/release.yml` through trusted publishing (OIDC) with provenance; `pnpm release` refuses to publish outside that workflow.

## How a release happens

1. Pull requests that change what users see add a changeset (`pnpm changeset`, see [.changeset/README.md](../.changeset/README.md)).
2. On every push to `main`, the release workflow opens or updates a **Version Packages** pull request that bumps `apps/cli/package.json` and writes the changelog.
3. Merging that pull request runs `pnpm check` — including building, packing, and installing the package with npm and pnpm — and then publishes through npm trusted publishing (OIDC) with provenance. The publish job runs on a GitHub-hosted runner, because npm accepts provenance only from those; every other job runs on Blacksmith.

## Package files

npm packs only `apps/cli`, so `pnpm --filter codeheat build` writes the package's `LICENSE` (a copy of the repository's MIT license) and its `README.md` (the repository README with repository-relative links made absolute) next to the bundle. Both are ignored by git and cached by turbo as build outputs. `scripts/check-cli-package.mjs` fails when either is missing, the LICENSE differs from the repository's, or the README keeps a relative link.

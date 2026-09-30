# Releasing

`codeheat` is published to npm by `.github/workflows/release.yml`. Apart from the one manual first release below, nobody publishes from a laptop (`pnpm release` refuses outside the workflow).

## How a release happens

1. Pull requests that change what users see add a changeset (`pnpm changeset`, see [.changeset/README.md](../.changeset/README.md)).
2. On every push to `main`, the release workflow opens or updates a **Version Packages** pull request that bumps `apps/cli/package.json` and writes the changelog.
3. Merging that pull request runs `pnpm check` — including building, packing, and installing the package with npm and pnpm — and then publishes through npm trusted publishing (OIDC) with provenance.

## First release (repository owner, once)

npm trusted publishing can only be configured for a package that already exists, so `0.1.0` is published by hand:

1. Merge the **Version Packages** pull request that the release workflow opens (it bumps `codeheat` to `0.1.0`); its publish job fails until step 3 is done.
2. On the merged `main`, run `pnpm install && pnpm check`, then publish from `apps/cli` with `npm publish --access public --provenance=false` (provenance needs the CI's OIDC token, which a local publish does not have).
3. On npmjs.com → `codeheat` → Settings → Trusted publishing, add repository `rexeus/codeheat` with workflow `release.yml`.

From then on, every merged Version Packages pull request publishes through the workflow with provenance, which npm only issues for a public source repository — `rexeus/codeheat` must be public before that first automated release (and before `0.1.0`, so the README's links work on the npm page).

`LICENSE` (MIT) exists twice: at the repository root and as `apps/cli/LICENSE`, the copy npm packs. `scripts/check-cli-package.mjs` fails when they differ.

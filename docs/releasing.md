# Releasing

`codeheat` is published to npm by `.github/workflows/release.yml`; nobody publishes from a laptop (`scripts/release.mjs` refuses).

## How a release happens

1. Pull requests that change what users see add a changeset (`pnpm changeset`, see [.changeset/README.md](../.changeset/README.md)).
2. On every push to `main`, the release workflow opens or updates a **Version Packages** pull request that bumps `apps/cli/package.json` and writes the changelog.
3. Merging that pull request runs `pnpm check` — including building, packing, and installing the package with npm and pnpm — and then publishes through npm trusted publishing (OIDC) with provenance.

## One-time setup (repository owner)

These steps need an npm account with rights to the package and cannot be automated:

1. **Claim the name.** `codeheat` was unclaimed on 2026-09-29. Publish once manually to own it, or create it on npmjs.com; fall back to `@rexeus/codeheat` if it is taken.
2. **Add the trusted publisher** on npmjs.com → package settings → Trusted publishing: repository `rexeus/codeheat`, workflow `release.yml`.
3. **Decide the repository visibility.** npm provenance requires a public source repository. While `rexeus/codeheat` is private, set `"provenance": false` in `apps/cli/package.json` `publishConfig`; OIDC publishing still works.
4. **Add a `LICENSE` file** matching the `license` field in `apps/cli/package.json` (currently `MIT`), and keep the two in sync.

import { spawnSync } from "node:child_process";

// Publishing is reserved for the release workflow, which authenticates to npm
// through trusted publishing (OIDC). A local publish would bypass provenance
// and the checks that gate the workflow, so refuse anything that is not the
// release workflow running on GitHub Actions with an OIDC token available.
const env = process.env;
/** @param {string | undefined} value */
const present = (value) => value !== undefined && value !== "";
const workflowRef = env["GITHUB_WORKFLOW_REF"] ?? "";
const isReleaseWorkflow = workflowRef.includes(
  "/.github/workflows/release.yml@",
);
const hasOidcToken =
  present(env["ACTIONS_ID_TOKEN_REQUEST_URL"]) &&
  present(env["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]);

if (env["GITHUB_ACTIONS"] !== "true" || !isReleaseWorkflow || !hasOidcToken) {
  console.error(
    "Refusing to publish outside the release workflow. Merge the Version Packages pull request; release.yml publishes through npm trusted publishing (OIDC).",
  );
  process.exit(1);
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(pnpm, ["exec", "changeset", "publish"], {
  stdio: "inherit",
});
if (result.error !== undefined) {
  console.error(`Could not start ${pnpm}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);

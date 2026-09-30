import packageJson from "../package.json" with { type: "json" };

/** The published `codeheat` version, shown by `--version` and written to reports. */
export const version = packageJson.version;

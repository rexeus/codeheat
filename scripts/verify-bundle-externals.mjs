import { readFileSync } from "node:fs";
import process from "node:process";

/**
 * Node built-in module names, with and without the `node:` prefix.
 * @type {Set<string>}
 */
const NODE_BUILTINS = new Set([
  "assert",
  "assert/strict",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "dns/promises",
  "domain",
  "events",
  "fs",
  "fs/promises",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "path/posix",
  "path/win32",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "readline/promises",
  "repl",
  "sqlite",
  "stream",
  "stream/consumers",
  "stream/promises",
  "stream/web",
  "string_decoder",
  "sys",
  "test",
  "timers",
  "timers/promises",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "util/types",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib",
]);

/** @type {ReadonlyArray<RegExp>} */
const SPECIFIER_PATTERNS = [
  /(?:^|\n)\s*import\s+[^;'"]*?from\s*["']([^"']+)["']/gu,
  /(?:^|\n)\s*import\s*["']([^"']+)["']/gu,
  /(?:^|\n)\s*export\s+[^;'"]*?from\s*["']([^"']+)["']/gu,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/gu,
];

/**
 * Extracts every module specifier an emitted bundle imports.
 * @param {string} source
 * @returns {string[]}
 */
const extractSpecifiers = (source) => {
  /** @type {string[]} */
  const specifiers = [];
  for (const pattern of SPECIFIER_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier !== undefined) {
        specifiers.push(specifier);
      }
    }
  }
  return specifiers;
};

/**
 * A single-file deployable may only reach for Node built-ins.
 *
 * Relative, absolute, `file:`, and `data:` specifiers are rejected too: a
 * self-contained artifact must not silently depend on a sibling chunk, a
 * workspace path, or an installed package.
 * @param {string} specifier
 * @returns {boolean}
 */
const isAllowed = (specifier) =>
  specifier.startsWith("node:") || NODE_BUILTINS.has(specifier);

/** @type {string[]} */
const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("verify-bundle-externals: pass at least one bundle path");
  process.exit(1);
}

let failed = false;
for (const target of targets) {
  const source = readFileSync(target, "utf8");
  const offenders = [
    ...new Set(extractSpecifiers(source).filter((value) => !isAllowed(value))),
  ];
  if (offenders.length > 0) {
    failed = true;
    console.error(`verify-bundle-externals: ${target} imports packages:`);
    for (const offender of offenders) {
      console.error(`  - ${offender}`);
    }
  }
}

if (failed) {
  console.error(
    "Deployable bundles must be self-contained apart from Node built-ins.",
  );
  process.exit(1);
}

console.log(
  `Bundle externals verified: ${targets.length} self-contained bundle(s)`,
);

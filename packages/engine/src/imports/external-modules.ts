// Owns telling which bare module specifiers name modules outside the
// repository's code that is accounted for: Node built-ins, protocols, and
// packages some manifest declares.

/** Node's built-in modules; `node:`-only ones (`test`, `sqlite`, …) need the prefix and are caught as protocols. */
const NODE_BUILTINS = new Set([
  "assert",
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
  "domain",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "sys",
  "timers",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib",
]);
/** `node:fs`, `npm:x`, `jsr:x`, `https://…`: the runtime or a registry resolves these. Other schemes (`virtual:`, `astro:`, `$app/`…) belong to a bundler plugin, which we cannot see. */
const PROTOCOL = /^(?:node|npm|jsr|https?):/u;

/** `name` of a bare specifier, and what follows it: `@a/b/c` is `@a/b` plus `c`. */
export const splitPackageName = (
  specifier: string,
): { readonly name: string; readonly subpath: string } => {
  const parts = specifier.split("/");
  const nameLength = specifier.startsWith("@") ? 2 : 1;
  return {
    name: parts.slice(0, nameLength).join("/"),
    subpath: parts.slice(nameLength).join("/"),
  };
};

/** The DefinitelyTyped package that types `name`: `x` is typed by `@types/x`, `@a/b` by `@types/a__b`. */
const typesPackageOf = (name: string): string =>
  `@types/${name.startsWith("@") ? name.slice(1).replace("/", "__") : name}`;

/**
 * Whether `specifier` names a module that is not repository code but is
 * accounted for: a Node built-in (also with a subpath such as `fs/promises`),
 * a protocol import, or a package in `declared`, the names the repository's
 * manifests declare as dependencies (a declared `@types/x` declares `x`).
 */
export const isAccountedExternal = (
  specifier: string,
  declared: ReadonlySet<string>,
): boolean => {
  if (PROTOCOL.test(specifier)) {
    return true;
  }
  const { name } = splitPackageName(specifier);
  return (
    NODE_BUILTINS.has(name) ||
    declared.has(name) ||
    declared.has(typesPackageOf(name))
  );
};

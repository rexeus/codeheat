---
"codeheat": minor
---

Measure module depth: how many lines of implementation sit behind each exported symbol. Each module in the JSON report gains `depth`, `{ exports, implementationLines, linesPerExport }`, for TypeScript and JavaScript modules: `exports` counts the distinct symbols of the module's entry points, following `export * from`, `export { x } from`, and `export * as ns from` within the module, and `implementationLines` the lines of its files that are neither entry points nor test code. It is `null` whenever the exports cannot be told exactly (no entry points, another language, a file that does not parse, CommonJS or `export =`, an `export *` from a package or another module, no exports, no implementation files) and without the parser. `analyze` lists the five shallowest ranked modules in the terminal, `inspect` states the depth of each matched file's module, and the treemap panel shows it in the interface section.

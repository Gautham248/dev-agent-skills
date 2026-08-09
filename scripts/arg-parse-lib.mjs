// scripts/arg-parse-lib.mjs
//
// Shared CLI argument parser used by work-log-cli.mjs, quiz-back-cli.mjs,
// interview-cli.mjs, and deviation-log-cli.mjs. Each was carrying its own
// copy of the same 12-line function -- extracted here so a fix in one place
// fixes all four.
//
// Dependency-free (node: builtins only), matching the codebase convention.

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}


## The mutation gate lies in two specific ways — check both before trusting a SURVIVED verdict

Found while gating a ZenStack policy change (8 models x write ops), 2026-10.

**1. A `-t` filter that matches zero tests exits 0, which reads as "MUTANT SURVIVED".**
Always run a **control** pass with the unmutated file first and confirm the pattern actually
selects tests. Watch for test-name interpolation: vitest wraps `it.each` substituted values in
quotes (`denies 'Task.create' as 'owner' when ...`), so a pattern written from the template
literal without those quotes silently matches nothing. A count of 0 is *not* a pass — assert
`numPassedTests > 0` before interpreting any verdict, or the entire gate is meaningless.

**2. If a generated artefact sits between the mutated file and the test, mutating the source
is not a valid mutation.** Two shapes seen in one sitting:

- Policy/runtime codegen: a `.zmodel` policy file is compiled into the enhanced client by a
  generate step. Editing the schema without re-running generate leaves the test executing the
  *old* policy, so a genuinely load-bearing mutant survives. Mutate → regenerate → test.
- A committed migration: `@unique` in an ORM schema file produced no behavioural difference,
  because the uniqueness was enforced by the **migration's** index in the database, not by the
  schema file. The mutant survived and was *correctly* not a gap — the fix was to mutate the
  layer the test actually reads (the migration) and reset the database. Deciding *which layer*
  a test pins is part of designing the gate, not an afterthought; a survivor is often "you
  mutated the wrong file" rather than "your test is weak".

Also: extracting pass/fail counts by grepping vitest's default output fails — ANSI escapes sit
between the words ("Tests", then colour codes, then "283 passed"). Use
`--reporter=json --outputFile=...` and read `numPassedTests` / `numFailedTests`.

# Self-Improvement Protocol

Read and follow this while using any skill, and especially when you're about
to finish using one. This applies regardless of which harness loaded you here
— Claude Code, Codex, Gemini CLI, OpenCode, Hermes, or anything else. It does
not depend on any harness having a special built-in tool for this; a normal
file-write capability is all it takes.

## The governing principle

A skill's instructions are written in advance, by someone who couldn't see
every situation you'd actually run into. When you hit something the skill
didn't anticipate — and you worked out the right way to handle it — that's
information the *next* run of this skill needs and doesn't have yet, on
whatever machine, with whatever harness, anyone else uses it. Writing it down
is what makes the skill better over time instead of hitting the same gap
forever.

This is not the same instinct as Step 3 of `CLARIFICATION-PROTOCOL.md`
("present a plan and stop"). That governs whether to act. This governs
whether to record what you learned *after* you already acted — it's a
wrap-up step, not a gate.

## What counts as an edge case (and what doesn't)

An edge case is something **the skill's instructions didn't cover, that you
had to figure out yourself**, and that would predictably come up again for
someone else using this skill. Concretely:

- The skill assumed a precondition (a file exists, a tool is installed, a
  repo is in some state) that wasn't true, and you had to improvise.
- The skill's documented command/flag/path was wrong or has changed upstream.
- You hit an ambiguous situation the skill didn't give a decision rule for,
  and you made a judgment call.
- A genuinely new failure mode that isn't already described in
  `references/edge-cases.md`.

**Anti-patterns — do not record these as edge cases:**

- Anything already covered in the skill's own instructions, even if you
  personally found it non-obvious at first. Re-reading carefully is not an
  edge case.
- Anything already present in `references/edge-cases.md`, even reworded. If
  you're about to write something that's substantively the same as an
  existing entry, don't add a near-duplicate — leave it alone.
- A one-off mistake on your part with no implication for the next run (e.g.
  you typo'd a path) — that's not a property of the skill.
- Ordinary, expected variation that the skill already handles by design
  (different file names, different repo sizes, etc.).
- Treating *every* run of a skill as worth a new entry. Most runs that go
  fine should produce zero entries. If you find yourself writing one after
  nearly every use, you're recording routine operation, not edge cases —
  stop and reconsider.

## What to do when you hit a real one

1. Locate (or create, if it doesn't exist yet) `references/edge-cases.md`
   inside this skill's own folder — never anywhere else, and never inside
   another skill's folder.
2. Append a new entry at the end, under its own dated heading:

   ```markdown
   ## YYYY-MM-DD — short title

   What happened: <the situation the skill's instructions didn't cover>
   What I did: <the judgment call or workaround>
   ```

3. Use whatever file-write capability you already have to do this directly
   — a dedicated "append to skill" tool if your harness happens to have one,
   or just writing the file, either is fine. There is no special mechanism
   required.
4. **Do not modify anything else.** Not the rest of `references/edge-cases.md`,
   not `SKILL.md`, not any other file in this skill. This protocol authorizes
   exactly one kind of edit: appending one new dated entry to this one file.
5. If you're genuinely unsure whether something qualifies (see the
   anti-patterns above), don't write the entry. A missed edge case costs
   nothing — someone else will hit it again and it'll get recorded then. A
   spurious entry pollutes the file for everyone after you.

## A note on frequency

This protocol is mirrored, in shorter form, as a pointer injected into every
skill's `SKILL.md` by `setup.sh` — the same defense-in-depth approach used
for `CLARIFICATION-PROTOCOL.md`. If you've already internalized this for the
current session, you don't need to re-read it in full every time you finish a
skill — but the substance (record real edge cases, only real edge cases, only
in this one file, only by appending) doesn't change.

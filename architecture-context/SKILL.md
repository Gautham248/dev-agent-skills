---
name: architecture-context
description: >
  Use to answer "what kind of system is this project, architecturally" --
  not "what does this diff do" (that's review-pr) and not "what does this
  specific function call" (that's a graphify query). Produces a small set
  of named subsystems (e.g. "state-sync", "matchmaking"), each with a
  plain-language summary and its anchor files, cached to
  graphify-out/.project-architecture.json so the expensive reasoning pass
  runs once and gets cheaply reused, not re-derived on every invocation.
  Invoked directly by other skills (review-pr, fix-bug, plan-feature,
  investigate-issue) that need standing project understanding before their
  own narrower, task-scoped work -- do not use this for a one-off "what
  does X call" question, use a graphify query for that instead.
graph-memory: true
---

<!-- BEGIN dev-agent-skills clarification protocol (managed by setup.sh -- do not edit this block manually; edit CLARIFICATION-PROTOCOL.md instead) -->
Before doing anything else in this skill, read and follow the clarification protocol at:
../config/CLARIFICATION-PROTOCOL.md
<!-- END dev-agent-skills clarification protocol -->

<!-- BEGIN dev-agent-skills self-improvement protocol (managed by setup.sh -- do not edit this block manually; edit SELF-IMPROVEMENT-PROTOCOL.md instead) -->
While using this skill, and especially when you finish, read and follow the self-improvement protocol at:
../config/SELF-IMPROVEMENT-PROTOCOL.md
(Append real edge cases to this skill's own references/edge-cases.md — create it if missing. See the protocol file for what qualifies.)
<!-- END dev-agent-skills self-improvement protocol -->

<!-- BEGIN dev-agent-skills graph-memory protocol (managed by setup.sh -- do not edit this block manually; edit GRAPH-MEMORY-PROTOCOL.md instead) -->
This skill opted in to graph-memory (graph-memory: true). At each point marked
'Graph-memory:' below, read and follow the graph-memory protocol at:
../config/GRAPH-MEMORY-PROTOCOL.md
<!-- END dev-agent-skills graph-memory protocol -->

# architecture-context

Answers "what kind of system is this, architecturally" once per project,
cheaply reuses that answer, and only redoes the expensive part for the
subsystems an actual change touched.

## Why this exists

`graphify` gives every skill in this repo a structural graph: what calls
what, what imports what. For a code-only repo (the common case --
`graphify/SKILL.md`'s Part B semantic extraction is skipped entirely when
there are zero docs/papers/images to reason about) that graph has nothing
semantic in it. It can tell you `syncState()` is called from three places.
It cannot tell you that those three places together implement
server-authoritative state sync for a multiplayer game. No amount of
rephrasing a `graphify query` recovers that, because the graph was never
given anything to answer it with.

This skill is the layer that adds it back -- once, cached, and scoped to
subsystems rather than one flat project description, so a consumer working
on `net/sync.ts` gets the state-sync summary without paying to re-derive
matchmaking, lobby, or UI context it doesn't need.

**This skill does not build or rebuild the structural graph.** It consumes
`graphify-out/`'s existing output (`graph.json`, the community-detection
sidecar, the stack-detection sidecar). If those don't exist yet, invoke
`graphify` first.

## How other skills invoke this

Directly, by name -- not via a CLI script. A consuming skill's own
instructions should say, at the point it needs standing project context:

> Invoke the `architecture-context` skill for `<the files this step
> touches>`.

Pass the specific files relevant to the calling skill's current work (a
PR's changed files for `review-pr`, the files a bug report points at for
`fix-bug`, and so on) -- this skill uses them in Step 5 to return only the
matching subsystem(s), not the whole cache. If no files are relevant yet
(a `plan-feature` session exploring a not-yet-written area), omit them and
this skill returns every subsystem it currently knows about.

## Step 1 -- Locate the graph, don't rebuild it

Resolve `graphify-out/` relative to the current working directory, same
convention `graphify` itself uses.

```bash
if [ ! -f graphify-out/graph.json ]; then
  echo "NO_GRAPH"
fi
```

If `NO_GRAPH`: tell the caller no structural graph exists yet for this
repo and stop -- do not build one yourself. Say explicitly: "invoke
`graphify` first, then retry `architecture-context`." Building the graph
is `graphify`'s job; this skill is a consumer of it, not a substitute for
it (see `## Why this exists` above).

## Step 2 -- Tier 1: is the cache still fresh at all?

Cheapest possible check, free if the graph hasn't been rebuilt since the
cache was last written:

```bash
node --input-type=module -e "
import { getGraphMtimeIso, loadCache, checkCacheTier1 } from '<path to architecture-context/scripts/architecture-context-lib.mjs>';
const graphMtime = getGraphMtimeIso('graphify-out/graph.json');
const cache = loadCache('graphify-out/.project-architecture.json');
console.log(checkCacheTier1(cache, graphMtime));
"
```

- **`fresh`** -- `graph.json` has not changed since this cache was
  written. Every subsystem entry is trustworthy as-is. Load
  `cache.subsystems` and skip straight to Step 5. This is the intended
  common case on repeat invocations within the same session or across
  sessions where nothing structural changed.
- **`missing`** -- no usable cache exists. Go to Step 4 and generate
  every subsystem from scratch (Step 3 has nothing to check yet).
- **`check`** -- the graph *was* rebuilt since the cache was written, but
  that doesn't mean every subsystem is stale -- most rebuilds touch one
  area of a large repo. Go to Step 3.

## Step 3 -- Tier 2: which specific subsystems does the change touch?

Only reached when Step 2 said `check`.

**Graph-memory:** before trusting anything the graph or its community
structure tells you in this step, follow the graph-memory protocol above.

Determine the changed-files set since the cache's own recorded git state,
not since some arbitrary point -- the cache stores exactly what it was
generated from for this reason:

```bash
node --input-type=module -e "
import { loadCache, getChangedFilesSince } from '<path>/architecture-context-lib.mjs';
const cache = loadCache('graphify-out/.project-architecture.json');
const changed = getChangedFilesSince('.', cache.generated_from_git_sha);
console.log(JSON.stringify(changed));
"
```

If this prints `null`: the recorded git sha is unreachable (shallow
clone, history rewrite, gc'd, or not a git repo at all). Do **not**
default to "nothing changed" -- that is the exact false-negative this
design cannot afford. Treat this the same as Step 2's `missing`: fall
through to Step 4 and regenerate every subsystem.

If it prints an array (possibly empty): expand it with `graphify affected`
so an indirect change (a function a subsystem depends on changed, even if
the subsystem's own files weren't literally edited) is also caught --
this reuses the exact tool `review-pr` Step 2 already relies on for the
same kind of blast-radius question, no new mechanism:

```bash
graphify affected --files "<changed files, space-separated>"
```

Union the direct changed-files list with whatever `graphify affected`
returns, then:

```bash
node --input-type=module -e "
import { loadCache, computeStaleSubsystems } from '<path>/architecture-context-lib.mjs';
const cache = loadCache('graphify-out/.project-architecture.json');
const { stale, fresh } = computeStaleSubsystems(cache.subsystems, <the unioned file list>);
console.log(JSON.stringify({ stale, fresh }));
"
```

If `stale` is empty: nothing changed that any known subsystem's anchor
files touch. Refresh the cache's top-level `generated_from_graph_mtime` /
`generated_from_git_sha` (so the next Step 2 check is `fresh` again)
without regenerating any subsystem content, and go to Step 5.

If `stale` is non-empty: go to Step 4, but only for the subsystem ids in
`stale`. Everything in `fresh` is carried over unchanged.

**Known limitation, do not try to fix this:** this is file-level, not
line-level or semantic. A subsystem is marked stale if any anchor file
changed at all, even if the actual edit was cosmetic. The alternative --
trying to judge whether a change was "architecturally meaningful" -- risks
under-triggering (missing a real shift), which is the unsafe direction.
Over-triggering (an occasional unnecessary re-derivation) is the accepted
cost. This mirrors `graphify`'s own accepted-gap pattern for
`.graphify_root` (see its SKILL.md) -- state the limit plainly rather than
pretend a cheap check catches everything.

## Step 4 -- Tier 3: (re)derive subsystems

This is the only step that costs real reasoning. Everything before it was
free or cheap by design.

**First run (Step 2 said `missing`, or Step 3's fallback triggered):**
generate every subsystem.

**Refresh (some subsystems in `stale`):** regenerate only those.

### 4a -- First run: seed subsystems from community detection

**Graph-memory:** follow the protocol above before relying on the
community structure this reads.

```bash
node --input-type=module -e "
import fs from 'node:fs';
import { communitiesToSubsystemSeeds } from '<path>/architecture-context-lib.mjs';
const graph = JSON.parse(fs.readFileSync('graphify-out/graph.json', 'utf8'));
const analysis = JSON.parse(fs.readFileSync('graphify-out/.graphify_analysis.json', 'utf8'));
let labels = null;
try { labels = JSON.parse(fs.readFileSync('graphify-out/.graphify_labels.json', 'utf8')); } catch {}
console.log(JSON.stringify(communitiesToSubsystemSeeds(graph, analysis, labels), null, 2));
"
```

If `.graphify_analysis.json` doesn't exist, `graphify`'s own Step 4
(clustering) hasn't run for this graph yet -- tell the caller to run
`/graphify <path> --cluster-only` (or a full build) first, same as
Step 1's `NO_GRAPH` case, and stop.

Each seed gives you a ranked candidate file list per community, largest
communities first. For each seed, in order:

1. Read the seed's `candidate_anchor_files` (only those files -- not the
   community's full file list, which can be much larger; the seed already
   ranked by how many in-community nodes cite each file, so the top
   entries are the most structurally central ones).
2. Write a 1-3 sentence plain-language summary of what this subsystem
   *does*, in the same spirit as `graphify` Step 5's community labels but
   with substance behind it, not just a name.
3. Choose a kebab-case subsystem id (`state-sync`, not `Community 0` and
   not the raw `community_id`). Use `suggested_label` as a naming hint if
   present, but don't keep it verbatim if it's generic ("Community 0") or
   doesn't read as an architectural concept -- also check
   `graphify-out/.graphify_stack.json`'s `notable_dirs`/`notable_files`
   for a better signal (e.g. a community anchored in a `migrations/`
   directory is probably `database-schema`, not whatever label clustering
   alone produced).
4. Keep `candidate_anchor_files` as `anchor_files` as-is, unless one is
   obviously not architecturally relevant (a config file that happened to
   cluster in) -- don't aggressively prune; a slightly-too-broad anchor
   list only costs an occasional extra tier-2 re-check, which is the
   accepted-cheap direction, while an over-pruned one risks silently
   missing staleness later.

Skip a community entirely (don't create a subsystem for it) if its
`node_count` is very small relative to the largest communities and its
files don't cohere into anything you could honestly summarize in one
sentence -- not every graph community is a meaningful architectural
subsystem, and forcing a summary onto an incoherent one produces noise a
consumer will trust incorrectly. **Graph-memory:** if you skip a
community this way, record it with `--outcome dead_end` (using a real
node id from that community, not the file path -- non-code-node tags
don't resolve on the next `reflect`, per the protocol's own tested note)
so the next run doesn't re-spend reasoning on the same incoherent
cluster.

### 4b -- Refresh: re-derive only the stale subsystems

For each subsystem id in Step 3's `stale` list, use its *existing*
`anchor_files` (don't re-run community detection or re-seed from
scratch) plus its immediate graph neighbors:

```bash
graphify affected --files "<this subsystem's anchor_files>" --relation calls --depth 1
```

Re-read those files, rewrite the subsystem's `summary`, and update
`anchor_files` only if the change clearly added or removed a file from
the subsystem (e.g. a new file implementing the same responsibility) --
stay conservative here; this is a refresh of an established subsystem
boundary, not a re-clustering.

### 4c -- Write the cache

Assemble an `updates` object keyed by subsystem id (only the ids you just
(re)generated in 4a or 4b), then:

```bash
node --input-type=module -e "
import { loadCache, mergeSubsystemUpdates, writeCache, getHeadSha, getGraphMtimeIso } from '<path>/architecture-context-lib.mjs';
const cache = loadCache('graphify-out/.project-architecture.json');
const graphMtimeIso = getGraphMtimeIso('graphify-out/graph.json');
const gitSha = getHeadSha('.');
const updates = <the updates object you assembled>;
const result = mergeSubsystemUpdates({ cache, updates, graphMtimeIso, gitSha, nowIso: new Date().toISOString() });
writeCache('graphify-out/.project-architecture.json', result);
console.log('wrote', Object.keys(result.subsystems).length, 'subsystems');
"
```

`writeCache` validates the schema before writing and throws rather than
writing something malformed -- if it throws, stop and report the
validation errors rather than retrying blindly.

**Graph-memory:** once you know whether each newly-written subsystem's
summary actually reads as correct against the files you just read (not
just "did the script run"), call `graphify save-result` for it -- honest
`useful`/`corrected` per the protocol above, tagged with a real node id
from that subsystem's community, not the file path.

## Step 5 -- Return the relevant slice

If the caller passed a target file list, narrow to just what's relevant:

```bash
node --input-type=module -e "
import { loadCache, selectSubsystemsForFiles } from '<path>/architecture-context-lib.mjs';
const cache = loadCache('graphify-out/.project-architecture.json');
console.log(JSON.stringify(selectSubsystemsForFiles(cache.subsystems, <target files>), null, 2));
"
```

If no target files were given, or none of `cache.subsystems` matches any
of them, return every subsystem the cache currently has -- say plainly if
the target files matched none of them (a genuinely new area of the
codebase, not yet covered by any subsystem), rather than silently
returning nothing or returning unrelated subsystems as if they applied.

Present each returned subsystem as: id, one-line summary, anchor files.
This is meant to be read by another skill's own reasoning step, not
formatted as a user-facing report -- keep it terse.

## What this skill deliberately does not do

- **Does not build or rebuild the graph.** Consumes `graphify-out/`,
  never runs `/graphify <path> --update` itself. If the graph is stale in
  the structural sense `graphify check-update` would catch, that's the
  calling skill's responsibility to handle before invoking this one.
- **Does not do PR-diff-scoped review.** That's `review-pr`'s job, and
  its diff-scoped-per-lens design (`review-pr/SKILL.md` Step 4) is
  deliberate and this skill does not weaken it by trying to read whole
  diffs itself.
- **Does not attempt line-level or semantic staleness detection.** See
  Step 3's "Known limitation" note.
- **Does not merge, commit, or open a PR.** Writes only
  `graphify-out/.project-architecture.json`.

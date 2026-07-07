# Clone and Knowledge-Graph Workflow

Exact mechanics behind Steps 2–4 of `SKILL.md`.

**Keep in sync with `fix-bug` Steps 2–3.** The two skills deliberately use
identical persistent paths so a graph built by one is reused by the other —
if either skill changes its clone/graph mechanics, mirror the change here.

## Operating modes (from Step 0)

- **Inside the target repo's checkout:** no clone. Work in place. If a
  `graphify-out/` already exists in the checkout, apply the same staleness
  check below against it before rebuilding.
- **dev-agent service:** persistent paths as follows.

## Clone or pull (persistent location)

Repos are cloned to a **persistent** path, not `/tmp` — this lets the graph
be reused across jobs instead of rebuilt from scratch every time.

```bash
REPO_DIR=/app/data/repos/<owner>__<repo>

if [ -d "$REPO_DIR/.git" ]; then
  git -C "$REPO_DIR" checkout main
  git -C "$REPO_DIR" pull origin main
else
  mkdir -p /app/data/repos
  git clone https://github.com/<owner>/<repo>.git "$REPO_DIR"
fi

CURRENT_SHA=$(git -C "$REPO_DIR" rev-parse HEAD)
```

## Build or reuse the graph (staleness-checked)

```bash
GRAPH_DIR=/app/data/graphs/<owner>__<repo>
GRAPH_FILE="$GRAPH_DIR/graphify-out/graph.json"
SHA_FILE="$GRAPH_DIR/built-at-sha.txt"

# Reuse check — always run this before extracting anything:
if [ -f "$GRAPH_FILE" ] && [ -f "$SHA_FILE" ] && \
   [ "$(cat "$SHA_FILE")" = "$CURRENT_SHA" ]; then
  echo "Graph is fresh (built at current HEAD) — reusing $GRAPH_FILE"
  # Skip directly to the queries below. Do not re-extract.
fi
```

Only if that check fails (no graph yet, or the repo moved since it was
built) — rebuild:

```bash
mkdir -p "$GRAPH_DIR"
graphify extract "$REPO_DIR" --out "$GRAPH_DIR" --no-browser --backend openai
echo "$CURRENT_SHA" > "$SHA_FILE"
```

`--backend openai` is not real OpenAI — `OPENAI_BASE_URL`/`OPENAI_MODEL` are
configured to point at the same endpoint everything else in this deployment
uses. If extraction fails needing semantic analysis of non-code files, the
configured backend's key should already be in the environment — do not
hardcode a specific provider's key, and do not try a different provider's key
as a workaround (see `fix-bug/references/edge-cases.md`, 2026-06-08, for why
that fails). If it still fails, report the exact error rather than guessing.

## The four context queries (Step 4)

Run all four before writing the plan; read the most relevant files from each
result:

```bash
# 1. Where similar/related functionality lives
graphify query "<feature name> or related functionality" \
  --graph "$GRAPH_FILE" --budget 2000

# 2. The data layer
graphify query "data models schema database" \
  --graph "$GRAPH_FILE" --budget 2000

# 3. The API/routing layer
graphify query "API routes endpoints handlers" \
  --graph "$GRAPH_FILE" --budget 2000

# 4. The UI layer
graphify query "components pages views" \
  --graph "$GRAPH_FILE" --budget 2000
```

Result lines follow `NODE <name> [src=<filepath> loc=L<n> community=<n>]` —
extract the `src=` paths and read the files that appear most often.

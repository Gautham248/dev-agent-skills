# Graphify guide

How to use Graphify to query a repository's knowledge graph when fixing a bug.

## Building the graph

```bash
graphify extract /path/to/repo \
  --output /path/to/repo/graphify-out \
  --no-browser
```

Graphify scans the repo and classifies files into:
- **code** — TypeScript, JavaScript, Python, etc. Processed offline via AST, no API key needed.
- **docs** — Markdown, text, config files like TOML. Need an LLM API key.
- **images** — PNG, JPG, SVG. Need an LLM API key.

If the repo has docs or images, pass `GEMINI_API_KEY`:

```bash
GEMINI_API_KEY=<key> graphify extract /path/to/repo ...
```

If extraction still fails, find and remove the non-code files from the local
clone before retrying. The remote repo is unaffected.

```bash
# Find files graphify treats as docs
find /path/to/repo -type f | grep -v node_modules | grep -v .git | grep -v graphify-out \
  | grep -v "\.ts$\|\.tsx$\|\.js$\|\.jsx$\|\.json$\|\.css$\|\.html$"
# Remove them from the local clone, then re-run extract
```

## Querying the graph

```bash
graphify query "<natural language question>" \
  --graph /path/to/repo/graphify-out/graph.json \
  --budget 3000
```

## Output format

Every result line follows this exact format:

```
NODE <name> [src=<filepath> loc=L<n> community=<n>]
```

Examples:
```
NODE client.ts [src=src/integrations/supabase/client.ts loc=L1 community=0]
NODE supabase [src=src/integrations/supabase/client.ts loc=L11 community=0]
NODE Database [src=src/integrations/supabase/types.ts loc=L9 community=0]
```

## Parsing the output

Extract every `src=` value from NODE lines using this pattern:

```
NODE .+?\[src=(\S+?)\s+loc=
```

Count how many NODE lines reference each unique file. More references = more
relevant to the query.

## Picking the target file

Sort files by reference count descending. Then apply this priority:

1. File with role `config` and high reference count → **source of truth for
   configuration values**. Fix here.
2. File named `client` (e.g. `client.ts`, `supabase/client.ts`) → likely
   contains connection config. Prefer over generic files.
3. File with highest reference count overall.

When in doubt, read both the top candidate and the second candidate before
deciding. Config files are almost always the right place for URL/key/constant fixes.

## Query strategies

**Too few results:** broaden the query. Use the technology name rather than
the symptom.

| Bug description | Better query |
|---|---|
| "wrong URL on homepage" | "URL configuration external links" |
| "database not connecting" | "Supabase database client connection" |
| "API returning wrong data" | "API endpoint configuration routes" |

**Too many results:** look at the EDGE lines to find which file is the source
(not just a consumer). A file that other files import from is likely the
source of truth.

## Known file types graphify may misclassify as docs

- `.toml` files (Supabase config, Cargo.toml)
- `.lockb` files (Bun lockfile — binary, remove before extract)
- `.sql` migration files
- `.env` files

Remove these from the local clone before running extract if they cause failures.

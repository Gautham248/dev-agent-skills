# graphify

Official graphify skill from [safishamsi/graphify](https://github.com/safishamsi/graphify).

When `AGENT-STANDING-RULES.md` Rule 1 fires on the first question in any repo, this skill is invoked automatically. It:

- **Auto-installs** the `graphifyy` Python package if missing (via `uv` or `pip --break-system-packages`)
- **Extracts code** locally via tree-sitter AST — zero API calls
- **Extracts docs** via subagents using the IDE's own model — no separate API key needed
- **Builds** `graphify-out/graph.json` and caches it per HEAD SHA
- **Queries** answer natural-language questions from the graph thereafter

Nothing for the user to do beyond `git clone` + `bash setup.sh`.

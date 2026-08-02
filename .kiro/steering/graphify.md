---
inclusion: always
---

graphify: A knowledge graph of this project lives in `graphify-out/`. For codebase, architecture, or dependency questions, when `graphify-out/graph.json` exists, first run `graphify query "<question>"` (or `graphify path "<A>" "<B>"` / `graphify explain "<concept>"`). These return a scoped subgraph, usually much smaller than `GRAPH_REPORT.md` or raw grep output. Read `GRAPH_REPORT.md` only for broad architecture review or when those commands do not surface enough context.

After finishing any task that added, deleted, or renamed files, run `graphify update .` from the project root to keep the graph current. Skip it for pure content edits inside files already in the graph.

Notes when querying:
- The default answer is capped near 2000 tokens and silently truncates. If the output says TRUNCATED and the answer is not in view, re-run with `--budget 4000` or narrow the question instead of guessing.
- Treat node `src=`/`loc=` values as pointers, not proof. Open the file to confirm before making claims about behaviour.

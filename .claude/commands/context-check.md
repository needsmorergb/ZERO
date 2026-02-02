Aggregate full context for the current state of the project. Gather:

1. `git status` — what's changed
2. `git log --oneline -15` — recent commit history
3. `git diff --stat` — size of current changes
4. Check if bundles are stale (source files newer than bundle files)
5. Summarize any failing patterns or inconsistencies found

Output a concise status report I can use to decide what to work on next.

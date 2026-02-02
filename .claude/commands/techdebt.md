Scan the codebase for technical debt. Use subagents to check in parallel:

1. **Dead code**: Find unused exports, unreachable functions, and commented-out blocks across `src/`
2. **Duplication**: Identify repeated patterns between axiom and padre platform code that could be shared
3. **Error handling gaps**: Find catch blocks that swallow errors silently, or async calls without error handling
4. **Hardcoded values**: Find magic numbers, hardcoded URLs, or config that should be in constants
5. **TODO/FIXME/HACK comments**: Aggregate all developer notes that indicate unfinished work
6. **Bundle size**: Check if any large dependencies or unused imports are inflating the bundles

Present findings as a prioritized list with file locations and suggested fixes.

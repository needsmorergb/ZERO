Debug the X enrichment pipeline end-to-end for a given token or X handle. Argument: $ARGUMENTS (token mint address or X handle)

1. Trace the data flow: observed-adapter.js → client.js → Context API Worker → twitter154
2. Check FieldStatus values at each stage
3. Verify view-model.js correctly maps all statuses to display strings
4. Check if trust score calculation in narrative-trust.js handles the result correctly
5. Report where data is missing, stale, or incorrectly mapped

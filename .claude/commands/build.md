Run the full build pipeline for both platforms. After building:

1. Run `npm run build`
2. Check the output for errors
3. Run `git diff --stat` to verify the bundle diffs are reasonable (no unexpected large changes)
4. Report which bundles changed and their size delta

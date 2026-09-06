# Vendored third-party files

Copied in by hand so the talk runs with no network and no build step.

- `reveal.js/` — reveal.js 5.2.1 (MIT), from the `reveal.js` npm package. Only `dist/` (core + black theme) and `plugin/notes/` (speaker view) are kept.
- `fonts/` — JetBrains Mono 300/400 and Caveat 400, latin subsets, woff2, from `@fontsource/jetbrains-mono` and `@fontsource/caveat` 5.3.0 (SIL Open Font License 1.1).

To update: `npm pack <package>` in a scratch directory, extract, and copy the same files back in.

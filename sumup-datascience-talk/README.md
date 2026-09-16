# The Hugging Face Incident — 30-minute data-science talk

This subdirectory contains a focused 30-minute adaptation of the root deck for a technically experienced data-science audience. The slides keep the existing black/orange visual language and reuse the repository’s local scenes. There are no speaker notes; `OUTLINE_30_MIN.md` lists the sections and sources.

## Run locally

From the repository root, serve the whole repository so the iframe paths to the shared scenes and assets resolve:

```sh
./serve.sh
```

Open <http://localhost:8765/sumup-datascience-talk/index.html>.

The deck is designed at 1920×1080. `F` toggles fullscreen and `Space` advances. Scene slides forward keys to the existing standalone scenes in the repository root. The exporter can build this adaptation from the repository root:

```sh
uv run scripts/export.py --index sumup-datascience-talk/index.html \
  --name sumup-datascience-talk --out sumup-datascience-talk/dist
```

The standalone HTML in `dist/` includes the shared assets and animations and can be copied to another computer. The PDF is a static fallback: it shows the selected end state of each animation and omits the live timeline band. The dark mass-termination scene is intentional. Exports are generated files and are ignored by Git.

The root deck and its assets remain the source material and are intentionally left unchanged. The subdeck links to `../vendor`, `../shared`, `../assets`, and the existing root scene pages rather than copying those files.
